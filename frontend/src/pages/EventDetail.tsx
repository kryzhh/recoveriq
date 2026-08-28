import { useParams } from 'react-router-dom'

export default function EventDetail() {
  const { id } = useParams()

  return (
    <div className="p-8 text-slate-100">
      <h1 className="text-3xl font-semibold tracking-tight">Event Detail</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
        Showing event {id}.
      </p>
    </div>
  )
}