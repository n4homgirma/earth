import * as THREE from 'three'
import gsap from 'gsap'

export default class Scene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private mesh: THREE.Mesh
  private rafId: number = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    this.camera.position.z = 3

    const geometry = new THREE.IcosahedronGeometry(1, 1)
    const material = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      wireframe: true,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.scene.add(this.mesh)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    const pointLight = new THREE.PointLight(0xffffff, 1)
    pointLight.position.set(5, 5, 5)
    this.scene.add(ambientLight, pointLight)

    gsap.to(this.mesh.rotation, {
      y: Math.PI * 2,
      duration: 8,
      repeat: -1,
      ease: 'none',
    })

    window.addEventListener('resize', this.onResize)
    this.animate()
  }

  private animate = () => {
    this.rafId = requestAnimationFrame(this.animate)
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
    this.renderer.dispose()
  }
}
