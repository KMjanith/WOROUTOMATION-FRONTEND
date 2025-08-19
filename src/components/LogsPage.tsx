import React from 'react';
import './LogsPage.css';

const LogsPage: React.FC = () => {
  return (
    <div className="logs-page">
      <h2>System Logs</h2>
      <div className="coming-soon">
        <p>System Logs management page is coming soon...</p>
        <p>This page will display Docker container logs, system logs, and application logs.</p>
      </div>
    </div>
  );
};

export default LogsPage;
