import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    const first = ref.current?.querySelector<HTMLElement>('input,select,textarea,button')
    first?.focus()
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
      if (event.key !== 'Tab') return
      const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('input,select,textarea,button') ?? []).filter(e => !e.hasAttribute('disabled'))
      const last = elements.at(-1)
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); elements[0]?.focus() }
    }
    document.addEventListener('keydown', handle)
    return () => { document.removeEventListener('keydown', handle); previous?.focus() }
  }, [])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={ref} className="modal form-modal" role="dialog" aria-modal="true" aria-label={title}>
      <h2>{title}</h2><button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
      {children}
    </section>
  </div>
}
