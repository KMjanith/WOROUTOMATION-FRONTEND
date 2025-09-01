import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DeploymentModal from './DeploymentModal';
import './Navbar.css';

const Navbar = () => {
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  const handleUpRecipeClick = async () => {
    setDeploying(true);
    setDeployResult(null);

    try {
      // Start deployment and get deployment ID
      const response = await fetch('http://localhost:3001/api/deployment/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: 'personal:deploy -y'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Set deployment ID and show modal
        setDeploymentId(data.deploymentId);
        setShowDeploymentModal(true);
        setDeployResult('Deployment started successfully');
      } else {
        setDeployResult('Error: ' + (data.error || 'Failed to start deployment'));
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
        >
          <span className="button-content">
            {deploying ? (
              <span className="spinner"></span>
            ) : (
              'UP-RECIPE'
            )}
          </span>
        </button>
      </div>
      {deployResult && (
        <div className="deploy-result">
          {deployResult}
        </div>
      )}
      
      {/* Deployment Modal */}
      {showDeploymentModal && deploymentId && (
        <DeploymentModal
          deploymentId={deploymentId}
          onClose={() => setShowDeploymentModal(false)}
        />
      )}
    </nav>
  );
};

export default Navbar;