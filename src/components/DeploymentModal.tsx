import React, { useState, useEffect, useRef } from 'react';
import './DeploymentModal.css';

interface DeploymentModalProps {
  deploymentId: string;
  onClose: () => void;
}

interface DeploymentLogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warning' | 'success' | 'raw';
  message: string;
}

const DeploymentModal: React.FC<DeploymentModalProps> = ({ deploymentId, onClose }) => {
  const [logs, setLogs] = useState<DeploymentLogEntry[]>([]);
  const [status, setStatus] = useState<'running' | 'completed' | 'failed'>('running');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    // Connect to WebSocket for real-time deployment logs
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:3001/ws/deployment/${deploymentId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to deployment WebSocket');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'log') {
            const logEntry: DeploymentLogEntry = {
              timestamp: new Date().toLocaleTimeString(),
              level: data.level || 'info',
              message: data.message
            };
            setLogs(prev => [...prev, logEntry]);
          } else if (data.type === 'status') {
            setStatus(data.status);
          }
        } catch (error) {
          console.error('Error parsing deployment message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Deployment WebSocket connection closed');
        setConnected(false);
      };

      ws.onerror = (error) => {
        console.error('Deployment WebSocket error:', error);
        setConnected(false);
      };
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [deploymentId]);

  const handleClose = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    onClose();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'running': return '#ffa500';
      case 'completed': return '#00ff00';
      case 'failed': return '#ff4444';
      default: return '#ffa500';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#ff4444';
      case 'warning': return '#ffa500';
      case 'success': return '#00ff00';
      default: return '#ffffff';
    }
  };

  return (
    <div className="deployment-modal-overlay">
      <div className="deployment-modal">
        <div className="deployment-modal-header">
          <h3>Deployment Progress</h3>
          <div className="deployment-status">
            <span 
              className="status-indicator" 
              style={{ backgroundColor: getStatusColor() }}
            ></span>
            <span className="status-text">{status.toUpperCase()}</span>
          </div>
          <div className="connection-status">
            <span 
              className={`connection-indicator ${connected ? 'connected' : 'disconnected'}`}
            ></span>
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        
        <div className="deployment-logs">
          {logs.length === 0 ? (
            <div className="no-logs">
              <p>Waiting for deployment logs...</p>
              <div className="loading-spinner"></div>
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="log-entry">
                {log.level !== 'raw' && (
                  <span 
                    className="log-level"
                    style={{ color: getLogLevelColor(log.level) }}
                  >
                    [{log.level.toUpperCase()}]
                  </span>
                )}
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
        
        <div className="deployment-modal-footer">
          <div className="deployment-info">
            <small>Deployment ID: {deploymentId}</small>
          </div>
          <div className="deployment-actions">
            {status === 'completed' && (
              <button className="success-button" onClick={handleClose}>
                Deployment Complete
              </button>
            )}
            {status === 'failed' && (
              <button className="error-button" onClick={handleClose}>
                Deployment Failed
              </button>
            )}
            {status === 'running' && (
              <button className="secondary-button" onClick={handleClose}>
                Close (Running in Background)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeploymentModal;
