import './Navbar.css'

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>HUMMINGBIRD</h2>
      </div>
      <div className="navbar-menu">
        <a href="#home">Home</a>
        <a href="#about">About</a>
        <a href="#services">Services</a>
        <a href="#contact">Contact</a>
      </div>
    </nav>
  )
}

export default Navbar
