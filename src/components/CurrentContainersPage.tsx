import React, { useState, useEffect } from 'react';
import './CurrentContainersPage.css';

interface DockerContainer {
  containerId: string;
  image: string;
  created: string;
  status: string;
  ports: string;
  names: string;
}

const CurrentContainersPage: React.FC = () => {
    const [containers, setContainers] = useState<DockerContainer[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchContainers = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch('http://localhost:3001/api/docker/containers');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                setContainers(result.data);
            } else {
                setError(result.error || 'Failed to fetch containers');
            }
        } catch (err) {
            setError('Failed to connect to backend server. Make sure the backend is running on port 3001.');
            console.error('Error fetching containers:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContainers();
    }, []);

    // Filter containers based on search term
    const filteredContainers = containers.filter(container =>
        container.containerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        container.image.toLowerCase().includes(searchTerm.toLowerCase()) ||
        container.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        container.names.toLowerCase().includes(searchTerm.toLowerCase()) ||
        container.ports.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="current-containers-page">
            <h2>Current Docker Containers</h2>
            
            <div className="controls-section1">
                <input
                    type="text"
                    placeholder="Search containers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input1"
                />
                <button 
                    className="refresh-btn1"
                    onClick={fetchContainers}
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh Containers'}
                </button>
                <button 
                    className="clear-search-btn1"
                    onClick={() => setSearchTerm('')}
                    disabled={!searchTerm}
                >
                    Clear Search
                </button>
            </div>

            {error && (
                <div className="error-message">
                    <p>{error}</p>
                </div>
            )}

            {loading && (
                <div className="loading-message">
                    <p>Loading containers...</p>
                </div>
            )}

            {!loading && !error && (
                <div className="containers-table-wrapper">
                    {filteredContainers.length > 0 ? (
                        <>
                            <div className="containers-count">
                                Showing {filteredContainers.length} of {containers.length} containers
                            </div>
                            <table className="containers-table">
                                <thead>
                                    <tr>
                                        <th>Container ID</th>
                                        <th>Image</th>
                                        <th>Created</th>
                                        <th>Status</th>
                                        <th>Ports</th>
                                        <th>Names</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredContainers.map((container, index) => (
                                        <tr key={container.containerId || index}>
                                            <td className="container-id">{container.containerId}</td>
                                            <td className="image">{container.image}</td>
                                            <td className="created">{container.created}</td>
                                            <td className="status">{container.status}</td>
                                            <td 
                                                className="ports" 
                                                dangerouslySetInnerHTML={{ __html: container.ports }}
                                            ></td>
                                            <td className="names">{container.names}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    ) : (
                        <div className="no-containers">
                            <p>{searchTerm ? 'No containers match your search criteria' : 'No running containers found'}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CurrentContainersPage;
