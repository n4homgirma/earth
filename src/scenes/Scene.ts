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

  private targetRotY = 0
  private rotY = 0
  private targetCamZ = 3
  private camZ = 3
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

    // IBL environment — essential for PBR GLB materials to render correctly.
    // Without this, metallic/glossy surfaces appear pitch black.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    pmrem.compileEquirectangularShader()
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    this.camera.position.z = 3

    // Pivot group — receives scroll-driven rotation
    this.model = new THREE.Group()
    this.scene.add(this.model)

    // Fallback sphere shown until the GLB loads (or if it fails)
    const fallback = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x2266cc, roughness: 0.4, metalness: 0.3 }),
    )
    this.model.add(fallback)

    const loader = new GLTFLoader()
    loader.load(
      '/models/toy_paper_globe.glb.glb',
      (gltf) => {
        // Remove fallback once the real model is ready
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
        console.log('GLB loaded ✓', gltf.scene)
      },
      undefined,
      (err) => console.error('GLB load failed:', err),
    )

    // Directional lights complement the IBL for strong highlights and shadows
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
