import './Navbar.css'

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>
          <span className="platform-text">Platform Recipe Manager</span>{' '}
          <span className="hummingbird-text">HUMMINGBIRD</span>
        </h2>
      </div>
      <div className="navbar-menu">
        <a href="#home">Home</a>
        <a href="#containers">Containers</a>
        <a href="#logs">Logs</a>
        <a href="#images">Images</a>
        <a href="#h-configs">H.configs</a>
      </div>
    </nav>
  )
}

export default Navbar
