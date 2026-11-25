import { useEffect, useRef, useState } from 'react'
import { Focus, Minus, Monitor, Plus, RotateCcw, X } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

type View = 'overview' | 'front' | 'back' | 'side' | 'qr'
type ViewerControls = { view: (view: View) => void; zoom: (factor: number) => void }
type Props = { json: string; invoiceNumber: string; total: string; onClose: () => void }

export default function DeviceViewer({ json, invoiceNumber, total, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const qrRef = useRef<HTMLCanvasElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const controlsRef = useRef<ViewerControls | null>(null)
  const [zoom, setZoom] = useState(100)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      previousFocus?.focus()
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    const qr = qrRef.current
    if (!host || !qr) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    } catch {
      setError('No se pudo iniciar la vista 3D en este navegador. Puedes seguir viendo el QR aquí o volver a la factura.')
      return
    }
    setError('')
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.setAttribute('aria-label', 'Modelo 3D del dispositivo. Arrastra para girar; rueda para acercar; botón derecho para desplazar.')
    renderer.domElement.tabIndex = 0
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dfe8ee')
    scene.fog = new THREE.Fog('#dfe8ee', 16, 40)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.09
    controls.minDistance = 1.5
    controls.maxDistance = 18
    controls.minPolarAngle = 0.08
    controls.maxPolarAngle = Math.PI * 0.54
    controls.cursor.set(0, 1.7, 0)
    controls.maxTargetRadius = 4
    controls.listenToKeyEvents(renderer.domElement)
    const textures: THREE.Texture[] = []

    const graphite = new THREE.MeshStandardMaterial({ color: '#171c22', roughness: 0.36, metalness: 0.35 })
    const silver = new THREE.MeshStandardMaterial({ color: '#bec7cc', roughness: 0.28, metalness: 0.65 })
    const gold = new THREE.MeshStandardMaterial({ color: '#FCC40E', roughness: 0.32, metalness: 0.45 })
    const black = new THREE.MeshStandardMaterial({ color: '#06090d', roughness: 0.6 })
    const navy = new THREE.MeshStandardMaterial({ color: '#122C51', roughness: 0.48, metalness: 0.2 })
    const model = new THREE.Group()
    model.name = 'Dispositivo El Veleñito'
    scene.add(model)

    function box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, radius = 0.04) {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      model.add(mesh)
      return mesh
    }

    // Closed volumes: the QR is only on the front, never mirrored onto the back.
    box(3.15, 0.22, 2.05, 0, 0.22, 0, graphite, 0.07)
    box(3.2, 0.09, 2.1, 0, 0.375, 0, silver)
    for (const x of [-1.2, 1.2]) for (const z of [-0.7, 0.7]) {
      box(0.38, 0.11, 0.32, x, 0.065, z, black)
    }
    box(1.84, 3.12, 0.48, 0, 1.98, 0, silver, 0.1)
    box(1.82, 3.1, 0.10, 0, 1.98, 0.23, graphite)
    box(1.65, 2.91, 0.025, 0, 1.98, 0.29, gold, 0.012)
    box(1.59, 2.85, 0.025, 0, 1.98, 0.313, black, 0.012)
    box(1.61, 2.85, 0.04, 0, 1.98, -0.255, navy, 0.02)

    // Rear detailing is an interpretation of the single front reference.
    for (let row = 0; row < 7; row++) {
      box(1.03, 0.025, 0.012, 0, 2.85 - row * 0.085, -0.282, black, 0.005)
    }
    box(0.48, 0.18, 0.025, 0, 0.87, -0.29, graphite, 0.012)
    box(0.22, 0.055, 0.016, 0, 0.87, -0.309, black, 0.007)
    for (const x of [-0.68, 0.68]) for (const y of [0.72, 3.23]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.018, 16), silver)
      screw.rotation.x = Math.PI / 2
      screw.position.set(x, y, -0.285)
      model.add(screw)
      box(0.035, 0.007, 0.005, x, y, -0.297, black, 0.002)
    }

    function label(lines: string[], width: number, height: number, y: number, back = false) {
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 256
      const context = canvas.getContext('2d')!
      context.fillStyle = back ? '#122C51' : '#06090d'
      context.fillRect(0, 0, 1024, 256)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#FCC40E'
      context.font = 'bold 50px sans-serif'
      lines.forEach((line, i) => context.fillText(line, 512, (i + 0.5) * 256 / lines.length))
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      textures.push(texture)
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }))
      mesh.position.set(0, y, back ? -0.28 : 0.329)
      if (back) mesh.rotation.y = Math.PI
      model.add(mesh)
    }
    label(['TIENDA EL VELEÑITO'], 1.38, 0.27, 3.15)
    label(['ESCANEA Y OBTÉN', 'TU FACTURA'], 1.38, 0.36, 2.73)
    label(['Sin papel. Siempre contigo.'], 1.36, 0.23, 0.94)
    label(['EL VELEÑITO', 'PANTALLA DE FACTURACIÓN'], 1.24, 0.4, 1.8, true)
    label(['PROTOTIPO · CAJA 01'], 1.15, 0.2, 1.18, true)

    const qrTexture = new THREE.CanvasTexture(qr)
    qrTexture.colorSpace = THREE.SRGBColorSpace
    qrTexture.magFilter = THREE.NearestFilter
    qrTexture.minFilter = THREE.NearestFilter
    qrTexture.generateMipmaps = false
    textures.push(qrTexture)
    const qrPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), new THREE.MeshBasicMaterial({ map: qrTexture, toneMapped: false }))
    qrPlane.name = 'QR de la factura'
    qrPlane.position.set(0, 1.83, 0.33)
    model.add(qrPlane)

    scene.add(new THREE.HemisphereLight('#ffffff', '#64758a', 2.5))
    const key = new THREE.DirectionalLight('#fff3db', 4)
    key.position.set(-3, 7, 5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = key.shadow.camera.bottom = -5
    key.shadow.camera.right = key.shadow.camera.top = 5
    key.shadow.normalBias = 0.035
    scene.add(key)
    const rim = new THREE.DirectionalLight('#b7d9ff', 3)
    rim.position.set(4, 4, -4)
    scene.add(rim)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: '#dfe8ee', roughness: 0.9 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(30, 30, '#a9b9c5', '#c7d3dc')
    grid.position.y = 0.005
    scene.add(grid)

    // Fit each preset to the actual viewport, including narrow phone screens.
    let overviewDistance = 8
    let activePreset: View | null = 'overview'
    const fitDistance = (size: number) => size / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(camera.aspect, 1)) * 1.18
    const view = (next: View) => {
      activePreset = next
      // Flush inertia before setting a deterministic camera pose.
      controls.enableDamping = false
      controls.update()
      const target = next === 'qr' ? new THREE.Vector3(0, 1.83, 0.33) : new THREE.Vector3(0, 1.75, 0)
      let distance = Math.min(16, fitDistance(4))
      if (next === 'qr') {
        // Version 40 + quiet zone = 185 modules. An integer number of
        // framebuffer pixels per module avoids resampling the dense QR.
        const buffer = renderer.getDrawingBufferSize(new THREE.Vector2())
        const pixels = Math.max(185, Math.floor(Math.min(buffer.x, buffer.y) * 0.94 / 185) * 185)
        distance = 1.35 * buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * pixels)
        const worldPerPixel = 1.35 / pixels
        target.x -= ((buffer.x - pixels) % 2) * worldPerPixel / 2
        target.y += ((buffer.y - pixels) % 2) * worldPerPixel / 2
      }
      const direction = next === 'back' ? new THREE.Vector3(0, 0.12, -1)
        : next === 'side' ? new THREE.Vector3(1, 0.12, 0)
        : next === 'overview' ? new THREE.Vector3(0.65, 0.38, 1)
        : new THREE.Vector3(0, 0, 1)
      controls.target.copy(target)
      camera.position.copy(target).add(direction.normalize().multiplyScalar(distance))
      controls.update()
      controls.enableDamping = true
    }
    const zoomCamera = (factor: number) => {
      activePreset = null
      const offset = camera.position.clone().sub(controls.target)
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance))
      camera.position.copy(controls.target).add(offset)
      controls.update()
    }
    controlsRef.current = { view, zoom: zoomCamera }
    const updateZoom = () => setZoom(Math.round(overviewDistance / controls.getDistance() * 100))
    const onStart = () => { activePreset = null }
    controls.addEventListener('change', updateZoom)
    controls.addEventListener('start', onStart)
    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      camera.aspect = Math.max(width, 1) / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(Math.max(width, 1), Math.max(height, 1), false)
      overviewDistance = Math.min(16, fitDistance(4))
      if (activePreset) view(activePreset)
      updateZoom()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    // qrcode.react paints in an effect; upload once on the next frame.
    let firstFrame = true
    renderer.setAnimationLoop(() => {
      if (firstFrame) { qrTexture.needsUpdate = true; firstFrame = false }
      controls.update()
      renderer.render(scene, camera)
    })
    const contextLost = (event: Event) => {
      event.preventDefault()
      setError('La vista 3D perdió la conexión gráfica. Cierra y abre el visor para intentarlo de nuevo.')
      renderer.setAnimationLoop(null)
    }
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    setReady(true)

    return () => {
      controlsRef.current = null
      observer.disconnect()
      renderer.setAnimationLoop(null)
      controls.removeEventListener('change', updateZoom)
      controls.removeEventListener('start', onStart)
      controls.dispose()
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          geometries.add(object.geometry)
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [json])

  return <div className="device-view-backdrop">
    <section ref={dialogRef} tabIndex={-1} className="device-view" role="dialog" aria-modal="true" aria-labelledby="device-view-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose() }
        if (event.key === 'Tab') {
          const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), canvas[tabindex="0"]'))
          const first = elements[0], last = elements[elements.length - 1]
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
      }}>
      <header className="device-view-header">
        <div className="device-view-brand"><div className="device-view-brand-mark"><Monitor size={20} /></div><div><strong id="device-view-title">Dispositivo · Vista 360°</strong><span>Tienda El Veleñito</span></div></div>
        <div className="device-view-actions">
          <button className="button device-center-button" disabled={!ready || !!error} onClick={() => controlsRef.current?.view('qr')}><Focus size={16} /> Centrar QR</button>
          <button className="button button-secondary" onClick={onClose}><X size={16} /> Salir</button>
        </div>
      </header>
      <div className="device-view-presets" role="group" aria-label="Ángulos del dispositivo">
        {([['overview', 'Perspectiva'], ['front', 'Frente'], ['side', 'Lateral'], ['back', 'Atrás']] as const).map(([view, label]) =>
          <button key={view} disabled={!ready || !!error} onClick={() => controlsRef.current?.view(view)}>{label}</button>)}
      </div>
      <div className="device-render-stage">
        <div ref={hostRef} className="device-render-host" />
        <div className="device-view-controls" role="group" aria-label="Zoom del dispositivo">
          <button aria-label="Alejar QR" disabled={!ready || !!error} onClick={() => controlsRef.current?.zoom(1.2)}><Minus size={16} /></button>
          <span aria-label="Nivel de zoom">{zoom}%</span>
          <button aria-label="Acercar QR" disabled={!ready || !!error} onClick={() => controlsRef.current?.zoom(1 / 1.2)}><Plus size={16} /></button>
          <i />
          <button aria-label="Restablecer perspectiva" disabled={!ready || !!error} onClick={() => controlsRef.current?.view('overview')}><RotateCcw size={16} /></button>
        </div>
        <div className={error ? 'device-render-fallback' : 'device-texture-source'} aria-hidden={!error}>
          {error && <p role="alert">{error}</p>}
          <QRCodeCanvas ref={qrRef} value={json} size={1480} level="H" boostLevel={false} includeMargin />
        </div>
      </div>
      <footer className="device-view-footer">
        <div className="device-invoice-info"><div><span>Factura</span><strong>{invoiceNumber}</strong></div><div><span>Total</span><strong>{total}</strong></div><div><span>Vista interactiva</span><strong>Giro 360°</strong></div></div>
        <p>Arrastra para girar · botón derecho para desplazar · rueda para zoom.<br />En táctil: un dedo gira; dos dedos desplazan y acercan.</p>
      </footer>
    </section>
  </div>
}
