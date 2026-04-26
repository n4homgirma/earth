/**
 * Scene.ts — Core Three.js scene: flat-earth GLB model, camera, lighting,
 * and all user interaction (drag rotation, scroll zoom, touch).
 *
 * Lifecycle:
 *   new Scene(canvas)  → constructs renderer, loads model, starts RAF loop.
 *   enableScroll()     → gates drag/scroll input; called once sphere phase begins.
 *   dispose()          → cancels RAF, removes all event listeners, frees GPU memory.
 *
 * Coordinate conventions:
 *   World Y  = up.  Model is centred at origin after load-time normalisation.
 *   rotY     = horizontal spin (yaw),  driven by horizontal drag / wheel deltaX.
 *   rotX     = vertical tilt (pitch),  driven by vertical drag.
 *   camZ     = camera distance,        driven by vertical scroll / wheel deltaY.
 *              Clamped to [1.5, 8] world units.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export default class Scene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private model: THREE.Group
  private rafId = 0
  private scrollEnabled = false

  // Smoothed rotation values (lerp toward target each frame at 0.05 rate)
  private targetRotY = 0
  private rotY = 0
  private targetRotX = 0
  private rotX = 0

  // Mouse / pointer drag state
  private isDragging = false
  private dragX = 0
  private dragY = 0

  // Camera Z distance — lerped toward targetCamZ at 0.05 rate
  private targetCamZ = 3
  private camZ = 3

  // GLB animation playback
  private mixer: THREE.AnimationMixer | null = null
  private clock = new THREE.Clock()

  /**
   * Four edge midpoints in model-local space, computed after GLB load.
   * Index mapping: 0 = North (min-Z face), 1 = East (max-X face),
   *                2 = South (max-Z face), 3 = West (min-X face).
   * Used by SphereScreen to draw SVG connector lines from the model edges
   * to the callout text panels.
   */
  private edgePoints: THREE.Vector3[] = []

  // Touch tracking — stores the previous touch position for delta computation
  private touchX = 0
  private touchY = 0

  /**
   * Optional 2D canvas context for the thumbnail preview in SphereScreen.
   * When set, the renderer's output is blitted to this canvas every frame.
   */
  private thumbnailCtx: CanvasRenderingContext2D | null = null

  // Cached viewport size — updated in onResize, avoids DOM reads every frame
  private vpW = window.innerWidth
  private vpH = window.innerHeight

  constructor(canvas: HTMLCanvasElement) {
    // Renderer — alpha:true so the wave background canvas shows through
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    this.scene = new THREE.Scene()

    // IBL environment — RoomEnvironment gives neutral studio-like reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    pmrem.compileEquirectangularShader()
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    // Camera — FOV 60°, near/far chosen to avoid Z-fighting at typical zoom levels
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    this.camera.position.z = 3

    this.model = new THREE.Group()
    this.scene.add(this.model)

    // Fallback sphere shown while the GLB is loading
    const fallback = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x2266cc, roughness: 0.4, metalness: 0.3 }),
    )
    this.model.add(fallback)

    const loader = new GLTFLoader()
    loader.load(
      '/models/flat%20earth%20model.glb',
      (gltf) => {
        this.model.remove(fallback)

        // Normalise the model: centre it at the origin and scale so the
        // longest axis spans exactly 2 world units.
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 2 / maxDim

        gltf.scene.scale.setScalar(scale)
        gltf.scene.position.set(
          -center.x * scale,
          -center.y * scale,
          -center.z * scale,
        )

        this.model.add(gltf.scene)

        // Compute the 4 edge midpoints in model-local space.
        // Because model rotation is 0 at load time, world == local here.
        // These are stored as local coords; getEdgeScreenPositions() applies
        // the live matrixWorld to project them into screen space each frame.
        this.model.updateMatrixWorld(true)
        const mb = new THREE.Box3().setFromObject(this.model)
        const mc = mb.getCenter(new THREE.Vector3())
        this.edgePoints = [
          new THREE.Vector3(mc.x, mc.y, mb.min.z), // 0: North
          new THREE.Vector3(mb.max.x, mc.y, mc.z), // 1: East
          new THREE.Vector3(mc.x, mc.y, mb.max.z), // 2: South
          new THREE.Vector3(mb.min.x, mc.y, mc.z), // 3: West
        ]

        // Play all embedded animations (e.g. cloud/water loops in the GLB)
        if (gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(gltf.scene)
          gltf.animations.forEach((clip) => this.mixer!.clipAction(clip).play())
        }
      },
      undefined,
      (err) => console.error('GLB load failed:', err),
    )

    // Three-point lighting rig
    const key = new THREE.DirectionalLight(0xffffff, 2.0)
    key.position.set(5, 3, 5)
    const fill = new THREE.DirectionalLight(0xaabbff, 0.5)
    fill.position.set(-5, -2, -5)
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(key, fill, ambient)

    window.addEventListener('resize', this.onResize)
    window.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('touchstart', this.onTouchStart, { passive: true })
    window.addEventListener('touchmove', this.onTouchMove, { passive: false })

    this.animate()
  }

  /** Called by App once the sphere phase begins; unlocks all user input. */
  enableScroll() {
    this.scrollEnabled = true
  }

  /**
   * Adjusts target camera Z distance by dy pixels (mapped to world units).
   * dy > 0 = scroll down = zoom out (camera moves away).
   * Clamped to [1.5, 8] to keep the model on screen.
   */
  private applyVerticalDelta(dy: number) {
    this.targetCamZ = Math.max(1.5, Math.min(8, this.targetCamZ + dy * 0.004))
  }

  private onMouseDown = (e: MouseEvent) => {
    if (!this.scrollEnabled) return
    this.isDragging = true
    this.dragX = e.clientX
    this.dragY = e.clientY
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging || !this.scrollEnabled) return
    const dx = e.clientX - this.dragX
    const dy = e.clientY - this.dragY
    this.dragX = e.clientX
    this.dragY = e.clientY
    // 0.008 rad/px gives a comfortable drag-to-rotate feel
    this.targetRotY += dx * 0.008
    this.targetRotX += dy * 0.008
  }

  private onMouseUp = () => {
    this.isDragging = false
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.scrollEnabled) return
    e.preventDefault()
    // Normalise pixel/line/page deltaMode to pixel units
    const px = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 400 : 1
    this.targetRotY += e.deltaX * px * 0.004
    this.applyVerticalDelta(e.deltaY * px)
  }

  private onTouchStart = (e: TouchEvent) => {
    if (!this.scrollEnabled) return
    this.touchX = e.touches[0].clientX
    this.touchY = e.touches[0].clientY
  }

  private onTouchMove = (e: TouchEvent) => {
    if (!this.scrollEnabled) return
    e.preventDefault()
    const dx = e.touches[0].clientX - this.touchX
    const dy = e.touches[0].clientY - this.touchY
    this.touchX = e.touches[0].clientX
    this.touchY = e.touches[0].clientY
    // Inverted vs mouse so dragging left rotates clockwise (natural on touch)
    this.targetRotY -= dx * 0.008
    this.targetRotX -= dy * 0.008
  }

  /** Main render loop — runs every frame via requestAnimationFrame. */
  private animate = () => {
    this.rafId = requestAnimationFrame(this.animate)

    // Exponential smoothing (lerp factor 0.05) — gives inertia-like feel
    this.rotY += (this.targetRotY - this.rotY) * 0.05
    this.rotX += (this.targetRotX - this.rotX) * 0.05
    this.model.rotation.y = this.rotY
    this.model.rotation.x = this.rotX

    this.mixer?.update(this.clock.getDelta())

    this.camZ += (this.targetCamZ - this.camZ) * 0.05
    this.camera.position.z = this.camZ

    this.renderer.render(this.scene, this.camera)

    // Blit the rendered frame to the thumbnail canvas (SphereScreen "CURRENT VIEW")
    if (this.thumbnailCtx) {
      const { canvas } = this.thumbnailCtx
      this.thumbnailCtx.clearRect(0, 0, canvas.width, canvas.height)
      this.thumbnailCtx.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height)
    }
  }

  private onResize = () => {
    this.vpW = window.innerWidth
    this.vpH = window.innerHeight
    this.camera.aspect = this.vpW / this.vpH
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.vpW, this.vpH)
  }

  /**
   * Registers a 2D canvas for live thumbnail blitting.
   * Pass null to unregister (called on SphereScreen unmount).
   */
  setThumbnailCanvas(canvas: HTMLCanvasElement | null) {
    this.thumbnailCtx = canvas ? canvas.getContext('2d') : null
  }

  /**
   * Returns true if the given screen coordinate intersects the loaded model.
   * Used by WaveBackground to suppress click ripples on the model itself.
   */
  hitTestModel(clientX: number, clientY: number): boolean {
    if (this.model.children.length === 0) return false
    const ndc = new THREE.Vector2(
      (clientX / this.vpW) * 2 - 1,
      -(clientY / this.vpH) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.camera)
    return raycaster.intersectObject(this.model, true).length > 0
  }

  /** Returns the current smoothed rotation values for parallax calculations. */
  getRotation(): { rotY: number; rotX: number } {
    return { rotY: this.rotY, rotX: this.rotX }
  }

  /**
   * Projects the 4 model edge midpoints into screen pixel coordinates.
   * Returns an empty array if the GLB has not loaded yet.
   * Called every frame by SphereScreen's RAF loop to update SVG line endpoints.
   */
  getEdgeScreenPositions(): { x: number; y: number }[] {
    if (this.edgePoints.length === 0) return []
    return this.edgePoints.map(p => {
      const world = p.clone().applyMatrix4(this.model.matrixWorld)
      const ndc = world.project(this.camera)
      return {
        x: (ndc.x + 1) / 2 * this.vpW,
        y: (-ndc.y + 1) / 2 * this.vpH,
      }
    })
  }

  dispose() {
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('touchstart', this.onTouchStart)
    window.removeEventListener('touchmove', this.onTouchMove)
    this.renderer.dispose()
  }
}
