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

  // Rotation (horizontal scroll)
  private targetRotY = 0
  private rotY = 0

  // Zoom (vertical scroll, fallback when the model has no animations)
  private targetCamZ = 3
  private camZ = 3

  // Animation scrubbing (vertical scroll, when the GLB has animation clips)
  private mixer: THREE.AnimationMixer | null = null
  private actions: THREE.AnimationAction[] = []
  private animDuration = 0
  private targetAnimT = 0  // 0 → 1 along the timeline
  private animT = 0

  // Touch tracking
  private touchX = 0
  private touchY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    this.scene = new THREE.Scene()

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    pmrem.compileEquirectangularShader()
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    this.camera.position.z = 3

    this.model = new THREE.Group()
    this.scene.add(this.model)

    const fallback = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x2266cc, roughness: 0.4, metalness: 0.3 }),
    )
    this.model.add(fallback)

    const loader = new GLTFLoader()
    loader.load(
      '/models/globe%20paper.glb',
      (gltf) => {
        this.model.remove(fallback)

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

        // If the GLB ships with animation clips, set up a mixer and
        // prepare each action in paused state so we can scrub them by scroll.
        if (gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(gltf.scene)
          this.animDuration = 0
          gltf.animations.forEach((clip) => {
            const action = this.mixer!.clipAction(clip)
            action.play()
            action.paused = true
            this.actions.push(action)
            if (clip.duration > this.animDuration) this.animDuration = clip.duration
          })
          console.log(`GLB loaded with ${gltf.animations.length} animation(s), duration ${this.animDuration.toFixed(2)}s`)
        } else {
          console.log('GLB loaded (no embedded animations)')
        }
      },
      undefined,
      (err) => console.error('GLB load failed:', err),
    )

    const key = new THREE.DirectionalLight(0xffffff, 2.0)
    key.position.set(5, 3, 5)
    const fill = new THREE.DirectionalLight(0xaabbff, 0.5)
    fill.position.set(-5, -2, -5)
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(key, fill, ambient)

    window.addEventListener('resize', this.onResize)
    window.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('touchstart', this.onTouchStart, { passive: true })
    window.addEventListener('touchmove', this.onTouchMove, { passive: false })

    this.animate()
  }

  enableScroll() {
    this.scrollEnabled = true
  }

  private applyVerticalDelta(dy: number) {
    if (this.mixer) {
      // Scrub the animation timeline — full scroll through covers the full clip
      this.targetAnimT = Math.max(0, Math.min(1, this.targetAnimT + dy * 0.001))
    } else {
      this.targetCamZ = Math.max(1.5, Math.min(8, this.targetCamZ + dy * 0.004))
    }
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.scrollEnabled) return
    e.preventDefault()
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
    this.targetRotY -= dx * 0.008
    // Touch gesture down = scroll forward (positive dy)
    this.applyVerticalDelta(-dy * 2)
  }

  private animate = () => {
    this.rafId = requestAnimationFrame(this.animate)

    this.rotY += (this.targetRotY - this.rotY) * 0.05
    this.model.rotation.y = this.rotY

    if (this.mixer) {
      // Scrub each action's time independently — clips may have different durations
      this.animT += (this.targetAnimT - this.animT) * 0.08
      this.actions.forEach((action) => {
        action.time = this.animT * action.getClip().duration
      })
      this.mixer.update(0)   // apply the new times without advancing
    } else {
      this.camZ += (this.targetCamZ - this.camZ) * 0.05
      this.camera.position.z = this.camZ
    }

    this.renderer.render(this.scene, this.camera)
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  dispose() {
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('touchstart', this.onTouchStart)
    window.removeEventListener('touchmove', this.onTouchMove)
    this.renderer.dispose()
  }
}
