import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export default class Scene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private model: THREE.Group   // pivot that receives scroll-driven rotation
  private rafId = 0
  private scrollEnabled = false

  // Smooth rotation (horizontal scroll → Y axis)
  private targetRotY = 0
  private rotY = 0

  // Smooth zoom (vertical scroll → camera Z)
  private targetCamZ = 3
  private camZ = 3

  // Touch tracking
  private touchX = 0
  private touchY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    // Correct colour space + filmic tone-mapping for GLB PBR materials
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    this.camera.position.z = 3

    // Empty pivot added immediately; model is inserted once loaded
    this.model = new THREE.Group()
    this.scene.add(this.model)

    const loader = new GLTFLoader()
    loader.load(
      '/models/toy_paper_globe.glb.glb',
      (gltf) => {
        // Normalise: centre and scale to fit within a 2-unit diameter
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
      },
      undefined,
      (err) => console.error('Failed to load GLB model:', err),
    )

    // Lighting tuned for PBR GLB materials
    const ambient = new THREE.AmbientLight(0xffffff, 1.2)
    const sun = new THREE.DirectionalLight(0xffffff, 2.5)
    sun.position.set(5, 3, 5)
    const fill = new THREE.DirectionalLight(0xaabbff, 0.6)
    fill.position.set(-5, -2, -5)
    this.scene.add(ambient, sun, fill)

    window.addEventListener('resize', this.onResize)
    window.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('touchstart', this.onTouchStart, { passive: true })
    window.addEventListener('touchmove', this.onTouchMove, { passive: false })

    this.animate()
  }

  /** Unlock scroll interaction once the burst has fully faded */
  enableScroll() {
    this.scrollEnabled = true
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.scrollEnabled) return
    e.preventDefault()
    const px = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 400 : 1
    this.targetRotY += e.deltaX * px * 0.004
    this.targetCamZ = Math.max(1.5, Math.min(8, this.targetCamZ + e.deltaY * px * 0.004))
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
    this.targetCamZ = Math.max(1.5, Math.min(8, this.targetCamZ - dy * 0.008))
  }

  private animate = () => {
    this.rafId = requestAnimationFrame(this.animate)

    this.rotY += (this.targetRotY - this.rotY) * 0.05
    this.model.rotation.y = this.rotY

    this.camZ += (this.targetCamZ - this.camZ) * 0.05
    this.camera.position.z = this.camZ

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
