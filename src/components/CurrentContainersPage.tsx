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
    const [filteredContainers, setFilteredContainers] = useState<DockerContainer[]>([]);
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
                setFilteredContainers(result.data);
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

    const handleDeleteContainer = async (containerId: string) => {
        if (!window.confirm('Are you sure you want to delete this container?')) return;
        try {
            const response = await fetch(`http://localhost:3001/api/docker/containers/${containerId}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (result.success) {
                setContainers(prev => {
                    const newContainers = prev.filter(c => c.containerId !== containerId);
                    setFilteredContainers(newContainers);
                    return newContainers;
                });
            } else {
                alert(result.error || 'Failed to delete container');
            }
        } catch (err) {
            alert('Error deleting container');
        }
    };

    useEffect(() => {
        fetchContainers();
    }, []);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredContainers(containers);
        } else {
            const term = searchTerm.toLowerCase();
            const filtered = containers.filter(container =>
                container.containerId.toLowerCase().includes(term) ||
                container.image.toLowerCase().includes(term) ||
                container.status.toLowerCase().includes(term) ||
                container.names.toLowerCase().includes(term) ||
                container.ports.toLowerCase().includes(term)
            );
            setFilteredContainers(filtered);
        }
    }, [searchTerm, containers]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const clearSearch = () => {
        setSearchTerm('');
    };

    return (
        <div className="current-containers-page">
            <div className="containers-count">
                <div className="controls-section">
                    <h2>Docker Containers</h2>
                    
                    <div className="search-bar-container">
                        <input 
                            type="text" 
                            className="search-input"
                            placeholder="Search containers..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                        {searchTerm && (
                            <button 
                                className="clear-search-btn" 
                                onClick={clearSearch}
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    
                    <div className="count-label">
                        {searchTerm 
                            ? `Found ${filteredContainers.length} containers matching "${searchTerm}"`
                            : `Showing ${containers.length} Docker containers`
                        }
                    </div>
                    
                    <button
                        className="refresh-containers-btn"
                        onClick={fetchContainers}
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    <p>{error}</p>
                    <button onClick={fetchContainers}>Retry</button>
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
                            <table className="containers-table">
                                <thead>
                                    <tr>
                                        <th>Container ID</th>
                                        <th>Image</th>
                                        <th>Created</th>
                                        <th>Status</th>
                                        <th>Ports</th>
                                        <th>Names</th>
                                        <th>Actions</th>
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
                                            <td className="actions">
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDeleteContainer(container.containerId)}
                                                    title="Delete Container"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    ) : (
                        <div className="no-containers">
                            {searchTerm ? (
                                <>
                                    <p>No containers found matching "{searchTerm}"</p>
                                    <button onClick={clearSearch} className="clear-search-btn">Clear Search</button>
                                </>
                            ) : (
                                <>
                                    <p>No running containers found</p>
                                    <button onClick={fetchContainers} className="retry-btn">Refresh</button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CurrentContainersPage;