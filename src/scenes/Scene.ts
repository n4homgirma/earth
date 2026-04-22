import * as THREE from 'three'

export default class Scene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private mesh: THREE.Mesh
  private rafId = 0
  private scrollEnabled = false

  // Smooth rotation (horizontal scroll)
  private targetRotY = 0
  private rotY = 0

  // Smooth zoom (vertical scroll)
  private targetCamZ = 3
  private camZ = 3

  // Touch tracking
  private touchX = 0
  private touchY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    this.camera.position.z = 3

    const geometry = new THREE.SphereGeometry(1, 64, 64)
    const material = new THREE.MeshPhongMaterial({
      color: 0x2266cc,
      emissive: 0x0a1230,
      shininess: 80,
      specular: 0x4488cc,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.scene.add(this.mesh)

    // Low ambient so the dark side stays dark; strong directional for drama
    const ambient = new THREE.AmbientLight(0xffffff, 0.25)
    const sun = new THREE.DirectionalLight(0xffffff, 1.8)
    sun.position.set(5, 3, 5)
    const fill = new THREE.DirectionalLight(0x334499, 0.3)
    fill.position.set(-5, -2, -5)
    this.scene.add(ambient, sun, fill)

    window.addEventListener('resize', this.onResize)
    window.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('touchstart', this.onTouchStart, { passive: true })
    window.addEventListener('touchmove', this.onTouchMove, { passive: false })

    this.animate()
  }

  /** Called once the burst has faded and the sphere is fully revealed */
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
    this.mesh.rotation.y = this.rotY

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
