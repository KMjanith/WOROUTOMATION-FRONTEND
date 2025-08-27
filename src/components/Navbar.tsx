import { useState, useEffect } from 'react'
import './Navbar.css'

const Navbar = () => {
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  const handleUpRecipeClick = async () => {
    setDeploying(true)
    setDeployResult(null)

    try {
      const res = await fetch('http://localhost:3001/api/up-recipe/deploy', { method: 'POST' })
      const data = await res.json();
      if (data.success) {
        setDeployResult('Recipe Deployed successfully')
      } else {
        setDeployResult('Error:  ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      setDeployResult('Network error')
    }
    setDeploying(false)
  }

    // Hide message after 4 seconds
  useEffect(() => {
    if (deployResult) {
      const timer = setTimeout(() => setDeployResult(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [deployResult]);

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
        <button
          className="up-recipe-nav"
          onClick={handleUpRecipeClick}
          disabled={deploying}
          style={{ position: 'relative', minWidth: '120px' }}
        >
          {deploying ? (
            <span className="spinner"></span>
          ) : (
            'UP-RECIPE'
          )}
        </button>
      </div>
      {deployResult && (
        <div className="deploy-result">
          {deployResult}
        </div>
      )}
    </nav>
  )
}

export default Navbar
