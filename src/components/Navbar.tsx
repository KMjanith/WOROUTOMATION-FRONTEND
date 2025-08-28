import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { deployUpRecipe } from '../api/upRecipe.ts'; // Import the new API function
import './Navbar.css';

const Navbar = () => {
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  const handleUpRecipeClick = async () => {
    setDeploying(true);
    setDeployResult(null);

    try {
      const data = await deployUpRecipe();
      if (data.success) {
        setDeployResult('Recipe Deployed successfully');
      } else {
        setDeployResult('Error:  ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Network or API error:', error);
      setDeployResult('Network error');
    }
    setDeploying(false);
  };

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
        {/* Use Link components for navigation */}
        <Link to="/">Home</Link>
        <Link to="/containers">Containers</Link>
        <Link to="/logs">Logs</Link>
        <Link to="/images">Images</Link>
        <Link to="/h-configs">H.configs</Link>
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
  );
};

export default Navbar;