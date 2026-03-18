import '@/App.css'
import MediaBin from '@/components/MediaBin'
import PreviewPanel from '@/components/PreviewPanel'
import PropertiesPanel from '@/components/PropertiesPanel'
import TimelinePanel from '@/components/TimelinePanel'

export default function App() {
  return (
    <div className="app-shell">
      <MediaBin />
      <PreviewPanel />
      <PropertiesPanel />
      <TimelinePanel />
    </div>
  )
}
