import { useState } from 'react'
import './SidePanel.css'

const SidePanel = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <aside className={`side-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <h3>Docker Management</h3>
        <button className="toggle-btn" onClick={toggleSidebar}>
          <div className="hamburger">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
      </div>
      {!isCollapsed && (
        <nav className="panel-menu">
          <ul>
            <li>
              <a href="#current-containers" className="menu-item">
                Current Docker Containers
              </a>
            </li>
            <li>
              <a href="#find-container" className="menu-item">
                Find Container
              </a>
            </li>
            <li>
              <a href="#delete-container" className="menu-item">
                Delete Container
              </a>
            </li>
            <li>
              <a href="#list-images" className="menu-item">
                List Images
              </a>
            </li>
            <li>
              <a href="#delete-dangling" className="menu-item">
                Delete Dangling Images
              </a>
            </li>
          </ul>
        </nav>
      )}
    </aside>
  )
}

export default SidePanel
