import React, { useState, useEffect, useRef } from 'react';
import './LogsPage.css';

interface LogDirectory {
  name: string;
  path: string;
}

interface LogFile {
  name: string;
  path: string;
  stats: {
    size: number;
    mtime: string;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  basePath?: string;
  serviceName?: string;
  servicePath?: string;
}

interface TerminalWindow {
  id: string;
  file: LogFile;
  logs: string;
  position: { x: number; y: number };
  zIndex: number;
}

const LogsPage: React.FC = () => {
  const [directories, setDirectories] = useState<LogDirectory[]>([]);
  const [filteredDirectories, setFilteredDirectories] = useState<LogDirectory[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState<boolean>(false);
  const [terminals, setTerminals] = useState<TerminalWindow[]>([]);
  const [nextZIndex, setNextZIndex] = useState<number>(1000);
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  // Fetch log directories on component mount
  useEffect(() => {
    fetchDirectories();
  }, []);

  // Filter directories based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDirectories(directories);
    } else {
      const filtered = directories.filter(directory =>
        directory.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDirectories(filtered);
    }
  }, [directories, searchQuery]);

  const fetchDirectories = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:3001/api/logs/directories');
      const result: ApiResponse<LogDirectory[]> = await response.json();

      if (result.success) {
        setDirectories(result.data);
      } else {
        setError(result.error || 'Failed to fetch log directories');
      }
    } catch (err) {
      setError('Error connecting to backend');
      console.error('Error fetching directories:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogFiles = async (serviceName: string): Promise<void> => {
    try {
      setFilesLoading(true);

      const response = await fetch(`http://localhost:3001/api/logs/files/${serviceName}`);
      const result: ApiResponse<LogFile[]> = await response.json();

      if (result.success) {
        setLogFiles(result.data);
      } else {
        setError(result.error || 'Failed to fetch log files');
        setLogFiles([]);
      }
    } catch (err) {
      setError('Error fetching log files');
      setLogFiles([]);
      console.error('Error fetching log files:', err);
    } finally {
      setFilesLoading(false);
    }
  };

  const handleServiceSelect = (serviceName: string): void => {
    setSelectedService(serviceName);
    fetchLogFiles(serviceName);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = (): void => {
    setSearchQuery('');
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  // Open new terminal window with safe positioning
  const handleStreamLog = (file: LogFile): void => {
    const terminalId = `terminal-${Date.now()}`;
    const offset = terminals.length * 30;

    // Calculate safe initial position
    const defaultWidth = window.innerWidth * 0.8; // 80vw
    const defaultHeight = window.innerHeight * 0.6; // 60vh

    const maxX = Math.max(0, window.innerWidth - defaultWidth);
    const maxY = Math.max(0, window.innerHeight - defaultHeight);

    const safeX = Math.min(100 + offset, maxX);
    const safeY = Math.min(100 + offset, maxY);

    const newTerminal: TerminalWindow = {
      id: terminalId,
      file,
      logs: `Connecting to ${file.name}...\n`,
      position: { x: safeX, y: safeY },
      zIndex: nextZIndex
    };

    setTerminals(prev => [...prev, newTerminal]);
    setNextZIndex(prev => prev + 1);

    // Start streaming for this terminal
    startStreamForTerminal(terminalId, file);
  };

  const startStreamForTerminal = (terminalId: string, file: LogFile): void => {
    const url = `http://localhost:3001/api/logs/stream?path=${encodeURIComponent(file.path)}`;
    const es = new EventSource(url);

    eventSourcesRef.current.set(terminalId, es);

    es.onopen = () => {
      updateTerminalLogs(terminalId, logs => logs + '[Connected]\n');
    };

    es.onmessage = (event) => {
      updateTerminalLogs(terminalId, logs => logs + event.data + '\n');
    };

    es.onerror = () => {
      updateTerminalLogs(terminalId, logs => logs + '[Connection error]\n');
    };
  };

  const updateTerminalLogs = (terminalId: string, updater: (logs: string) => string): void => {
    setTerminals(prev => prev.map(terminal =>
      terminal.id === terminalId
        ? { ...terminal, logs: updater(terminal.logs) }
        : terminal
    ));
  };

  const closeTerminal = (terminalId: string): void => {
    // Close event source
    const es = eventSourcesRef.current.get(terminalId);
    if (es) {
      es.close();
      eventSourcesRef.current.delete(terminalId);
    }

    // Remove terminal from state
    setTerminals(prev => prev.filter(terminal => terminal.id !== terminalId));
  };

  const bringTerminalToFront = (terminalId: string): void => {
    setTerminals(prev => prev.map(terminal =>
      terminal.id === terminalId
        ? { ...terminal, zIndex: nextZIndex }
        : terminal
    ));
    setNextZIndex(prev => prev + 1);
  };

  const updateTerminalPosition = (terminalId: string, position: { x: number; y: number }): void => {
    setTerminals(prev => prev.map(terminal =>
      terminal.id === terminalId
        ? { ...terminal, position }
        : terminal
    ));
  };

  const addNewLineToTerminal = (terminalId: string): void => {
    updateTerminalLogs(terminalId, logs => logs + '\n');
  };

  return (
    <div className="logs-page">
      <div className="logs-container">
        {/* Sidebar */}
        <div className="logs-sidebar">
          <div className="sidebar-header">
            <div className="search-container">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="clear-search-btn"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                className="refresh-btn"
                onClick={fetchDirectories}
                disabled={loading}
                title="Refresh services list"
              >
                ↺
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading services...</div>
          ) : error ? (
            <div className="error">
              <p>Error: {error}</p>
              <button onClick={fetchDirectories}>Retry</button>
            </div>
          ) : filteredDirectories.length === 0 ? (
            <div className="no-data">
              {searchQuery ? `No services found matching "${searchQuery}"` : 'No services found'}
              {searchQuery && (
                <button onClick={clearSearch} className="clear-search-link">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="services-list">
              {searchQuery && (
                <div className="search-results-info">
                  Found {filteredDirectories.length} of {directories.length} services
                </div>
              )}
              {filteredDirectories.map((directory) => (
                <div
                  key={directory.name}
                  className={`service-item ${selectedService === directory.name ? 'selected' : ''}`}
                  onClick={() => handleServiceSelect(directory.name)}
                >
                  <span className="service-name">{directory.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="logs-content">
          {!selectedService ? (
            <div className="no-selection">
              <h3>Select a service from the sidebar to view its logs</h3>
              <p>Available services: {directories.length}</p>
              {searchQuery && (
                <p>Filtered services: {filteredDirectories.length}</p>
              )}
            </div>
          ) : (
            <div className="log-files-section">
              <div className="content-header">
                <h3>Log Files for: {selectedService}</h3>
                {filesLoading && <span className="loading-text">Loading files...</span>}
              </div>

              {filesLoading ? (
                <div className="loading">Loading log files...</div>
              ) : logFiles.length === 0 ? (
                <div className="no-data">No log files found for this service</div>
              ) : (
                <div className="log-files-table">
                  <table>
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Size</th>
                        <th>Last Modified</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logFiles.map((file, index) => (
                        <tr
                          key={index}
                          onDoubleClick={() => handleStreamLog(file)}
                          style={{ cursor: 'pointer' }}
                          title="Double click to open in new terminal"
                        >
                          <td className="file-name">{file.name}</td>
                          <td className="file-size">{formatFileSize(file.stats.size)}</td>
                          <td className="file-date">{formatDate(file.stats.mtime)}</td>
                          <td className="file-actions">
                            <button className="view-btn" onClick={() => handleStreamLog(file)}>
                              Open Terminal
                            </button>
                            <button className="download-btn">Download</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Multiple Terminal Windows */}
      {terminals.map((terminal) => (
        <TerminalWindow
          key={terminal.id}
          terminal={terminal}
          onClose={() => closeTerminal(terminal.id)}
          onFocus={() => bringTerminalToFront(terminal.id)}
          onMove={(position) => updateTerminalPosition(terminal.id, position)}
          onAddNewLine={() => addNewLineToTerminal(terminal.id)}
        />
      ))}
    </div>
  );
};

// Draggable Terminal Component with Boundary Constraints
interface TerminalWindowProps {
  terminal: TerminalWindow;
  onClose: () => void;
  onFocus: () => void;
  onMove: (position: { x: number; y: number }) => void;
  onAddNewLine: () => void;
}

const TerminalWindow: React.FC<TerminalWindowProps> = ({
  terminal,
  onClose,
  onFocus,
  onMove,
  onAddNewLine
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [inputValue, setInputValue] = useState<string>('');
  const terminalRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminal.logs]);

  // Focus input when terminal is focused
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [terminal.zIndex]);

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - terminal.position.x,
        y: e.clientY - terminal.position.y
      });
      onFocus();
    }
  };

  const handleMouseMove = (e: MouseEvent): void => {
    if (isDragging && terminalRef.current) {
      // Get terminal dimensions
      const terminalRect = terminalRef.current.getBoundingClientRect();
      const terminalWidth = terminalRect.width;

      // Calculate new position
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      // Apply boundary constraints
      // Minimum 50px of header must remain visible
      const minVisibleHeader = 50;

      // Left boundary
      newX = Math.max(-terminalWidth + minVisibleHeader, newX);

      // Right boundary  
      newX = Math.min(window.innerWidth - minVisibleHeader, newX);

      // Top boundary (keep header visible)
      newY = Math.max(0, newY);

      // Bottom boundary (keep at least header visible)
      newY = Math.min(window.innerHeight - minVisibleHeader, newY);

      onMove({ x: newX, y: newY });
    }
  };

  const handleMouseUp = (): void => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, terminal.position]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      onAddNewLine();
      setInputValue('');
    }
  };

  const handleTerminalClick = (): void => {
    onFocus();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Double-click header to center terminal
  const handleHeaderDoubleClick = (): void => {
    if (terminalRef.current) {
      const terminalRect = terminalRef.current.getBoundingClientRect();
      const centerX = (window.innerWidth - terminalRect.width) / 2;
      const centerY = (window.innerHeight - terminalRect.height) / 2;

      // Ensure centered position is within bounds
      const safeX = Math.max(0, Math.min(centerX, window.innerWidth - terminalRect.width));
      const safeY = Math.max(0, Math.min(centerY, window.innerHeight - terminalRect.height));

      onMove({ x: safeX, y: safeY });
    }
  };

  // Reset position if terminal is completely outside viewport
  useEffect(() => {
    if (terminalRef.current) {
      const rect = terminalRef.current.getBoundingClientRect();
      const isCompletelyOffScreen =
        rect.right < 50 ||
        rect.left > window.innerWidth - 50 ||
        rect.bottom < 50 ||
        rect.top > window.innerHeight - 50;

      if (isCompletelyOffScreen) {
        // Reset to safe position
        const safeX = Math.max(0, Math.min(100, window.innerWidth - 400));
        const safeY = Math.max(0, Math.min(100, window.innerHeight - 300));
        onMove({ x: safeX, y: safeY });
      }
    }
  }, [terminal.position, onMove]);

  return (
    <div
      ref={terminalRef}
      className="floating-terminal"
      style={{
        left: `${terminal.position.x}px`,
        top: `${terminal.position.y}px`,
        zIndex: terminal.zIndex
      }}
      onClick={handleTerminalClick}
    >
      <div
        className="terminal-header"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleHeaderDoubleClick}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        title="Drag to move, double-click to center"
      >
        <span className="terminal-title">{terminal.file.name}</span>
        <button className="terminal-close" onClick={onClose}>×</button>
      </div>

      <div className="terminal-body">
        <pre ref={outputRef} className="terminal-output">
          {terminal.logs}
        </pre>

        <div className="terminal-input-line">
          <span className="terminal-prompt">$ </span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="terminal-input"
            placeholder="Press Enter to add new line"
          />
        </div>
      </div>
    </div>
  );
};

export default LogsPage;