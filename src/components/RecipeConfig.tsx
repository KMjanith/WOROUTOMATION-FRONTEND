import { useState, useEffect } from 'react'
import './RecipeConfig.css'

interface ConfigItem {
  key: string
  value: string | string[]
  commented?: boolean
  isObject?: boolean
}

interface ConfigData {
  fileName: string
  items: ConfigItem[]
  error?: string
  path?: string
}

interface ApiResponse {
  success: boolean
  data: ConfigData[]
  directory: string
  error?: string
}

const RecipeConfig = () => {
  const [configData, setConfigData] = useState<ConfigData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [directory, setDirectory] = useState<string>('')
  const [newItem, setNewItem] = useState({ key: '', value: '' })
  const [newListItem, setNewListItem] = useState('')
  const [showAddForm, setShowAddForm] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<{ fileName: string, index: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean
    serviceName: string
    fileName: string
    itemIndex: number
    listItemIndex: number
  } | null>(null)
  const [toast, setToast] = useState<{
    show: boolean
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchConfigFiles = async () => {
      try {
        setLoading(true)
        const response = await fetch('http://localhost:3001/api/config')

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: ApiResponse = await response.json()

        if (result.success) {
          // Parse list values for deployment.services and special objects for overrides
          const parsedData = result.data.map(config => ({
            ...config,
            items: config.items.map(item => {
              if (item.key === 'deployment.services' && typeof item.value === 'string') {
                // Parse comma-separated list
                const listItems = item.value.split(',').map(v => v.trim()).filter(v => v)
                return { ...item, value: listItems }
              }
              // Backend already handles object detection and commented status
              return item
            })
          }))
          setConfigData(parsedData)
          setDirectory(result.directory)
          setError(null)
        } else {
          setError(result.error || 'Failed to load configuration files')
        }

      } catch (err) {
        setError('Failed to connect to backend server. Make sure the backend is running on port 3001.')
        console.error('Error loading config files:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchConfigFiles()
  }, [])

  const handleDelete = (fileName: string, itemIndex: number) => {
    setConfigData(prev => prev.map(config => {
      if (config.fileName === fileName) {
        return {
          ...config,
          items: config.items.filter((_, index) => index !== itemIndex)
        }
      }
      return config
    }))
  }

  const handleDeleteListItem = (fileName: string, itemIndex: number, listItemIndex: number) => {
    // Get the service name for confirmation
    const config = configData.find(c => c.fileName === fileName);
    const item = config?.items[itemIndex];
    if (item && Array.isArray(item.value)) {
      const serviceName = item.value[listItemIndex];
      setDeleteConfirmation({
        show: true,
        serviceName,
        fileName,
        itemIndex,
        listItemIndex
      });
    }
  }

  const confirmDelete = () => {
    if (deleteConfirmation) {
      const { fileName, itemIndex, listItemIndex } = deleteConfirmation;
      setConfigData(prev => prev.map(config => {
        if (config.fileName === fileName) {
          return {
            ...config,
            items: config.items.map((item, index) => {
              if (index === itemIndex && Array.isArray(item.value)) {
                return {
                  ...item,
                  value: item.value.filter((_, listIndex) => listIndex !== listItemIndex)
                }
              }
              return item
            })
          }
        }
        return config
      }))
      setDeleteConfirmation(null);
    }
  }

  const cancelDelete = () => {
    setDeleteConfirmation(null);
  }

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    // Only auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        setToast(null);
      }, 3000);
    }
  }

  const hideToast = () => {
    setToast(null);
  }

  // Process configuration data without hardcoded defaults
  const processConfigData = (config: ConfigData) => {
    // Just return the config as-is, backend now handles commented detection
    return config;
  }

  // Function to filter services based on search term
  const filterServices = (services: string[]) => {
    if (!searchTerm.trim()) {
      return services;
    }

    const searchLower = searchTerm.toLowerCase().trim();

    return services.filter(service => {
      const serviceName = service.replace('#', '').toLowerCase().trim();
      const originalService = service.toLowerCase().trim();

      // Exact match gets priority
      if (serviceName === searchLower || originalService === searchLower) {
        return true;
      }

      // Then check if the service starts with the search term
      if (serviceName.startsWith(searchLower) || originalService.startsWith(searchLower)) {
        return true;
      }

      // Finally, partial match (but only if search term is longer than 2 characters to avoid too many matches)
      if (searchLower.length > 2) {
        return serviceName.includes(searchLower) || originalService.includes(searchLower);
      }

      return false;
    });
  }

  // Function to filter overrides items based on search term
  const filterOverridesItems = (items: ConfigItem[]) => {
    if (!searchTerm.trim()) {
      return items;
    }

    const searchLower = searchTerm.toLowerCase().trim();

    return items.filter(item => {
      const keyName = item.key.toLowerCase().trim();

      // For objects, also search in the content
      if (item.isObject && typeof item.value === 'string') {
        const objectContent = item.value.toLowerCase();
        return keyName.includes(searchLower) || objectContent.includes(searchLower);
      }

      // For regular key-value pairs, search in key and value
      const itemValue = typeof item.value === 'string' ? item.value.toLowerCase() : '';

      // Exact match gets priority
      if (keyName === searchLower) {
        return true;
      }

      // Then check if the key starts with the search term
      if (keyName.startsWith(searchLower)) {
        return true;
      }

      // Finally, partial match in key or value (if search term is longer than 2 characters)
      if (searchLower.length > 2) {
        return keyName.includes(searchLower) || itemValue.includes(searchLower);
      }

      return false;
    });
  }

  const handleUpdateRecipe = async (fileName: string) => {
    try {
      const config = configData.find(c => c.fileName === fileName);
      if (!config) return;

      const response = await fetch('http://localhost:3001/api/config/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: fileName,
          items: config.items
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast('success', `Successfully updated ${fileName}!`);
      } else {
        showToast('error', `Error saving file: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showToast('error', 'Failed to save configuration. Make sure the backend server is running.');
    }
  }

  const handleCommentListItem = (fileName: string, itemIndex: number, listItemIndex: number) => {
    setConfigData(prev => prev.map(config => {
      if (config.fileName === fileName) {
        return {
          ...config,
          items: config.items.map((item, index) => {
            if (index === itemIndex && Array.isArray(item.value)) {
              return {
                ...item,
                value: item.value.map((listItem, listIndex) => {
                  if (listIndex === listItemIndex) {
                    // Toggle comment status by adding/removing # prefix
                    return listItem.startsWith('#') ? listItem.substring(1).trim() : `# ${listItem}`
                  }
                  return listItem
                })
              }
            }
            return item
          })
        }
      }
      return config
    }))
  }

  const handleCommentItem = (fileName: string, itemIndex: number) => {
    setConfigData(prev => prev.map(config => {
      if (config.fileName === fileName) {
        return {
          ...config,
          items: config.items.map((item, index) => {
            if (index === itemIndex && !item.isObject && !Array.isArray(item.value)) {
              return {
                ...item,
                commented: !item.commented
              }
            }
            return item
          })
        }
      }
      return config
    }))
  }

  const handleStartEdit = (fileName: string, itemIndex: number, currentValue: string) => {
    setEditingItem({ fileName, index: itemIndex })
    setEditValue(currentValue)
  }

  const handleSaveEdit = () => {
    if (editingItem && editValue.trim()) {
      setConfigData(prev => prev.map(config => {
        if (config.fileName === editingItem.fileName) {
          return {
            ...config,
            items: config.items.map((item, index) => {
              if (index === editingItem.index) {
                return { ...item, value: editValue.trim() }
              }
              return item
            })
          }
        }
        return config
      }))
      setEditingItem(null)
      setEditValue('')
    }
  }

  const handleCancelEdit = () => {
    setEditingItem(null)
    setEditValue('')
  }

  const handleAddItem = (fileName: string) => {
    if (newItem.key.trim() && newItem.value.trim()) {
      setConfigData(prev => prev.map(config => {
        if (config.fileName === fileName) {
          return {
            ...config,
            items: [...config.items, { key: newItem.key.trim(), value: newItem.value.trim() }]
          }
        }
        return config
      }))
      setNewItem({ key: '', value: '' })
      setShowAddForm(null)
    }
  }

  const handleAddListItem = (fileName: string, itemIndex: number) => {
    if (newListItem.trim()) {
      setConfigData(prev => prev.map(config => {
        if (config.fileName === fileName) {
          return {
            ...config,
            items: config.items.map((item, index) => {
              if (index === itemIndex && Array.isArray(item.value)) {
                return {
                  ...item,
                  value: [...item.value, newListItem.trim()]
                }
              }
              return item
            })
          }
        }
        return config
      }))
      setNewListItem('')
      setShowAddForm(null)
    }
  }

  if (loading) {
    return (
      <div className="recipe-config">
        <div className="loading">Loading configuration files...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="recipe-config">
        <div className="error">
          <h3>Error Loading Configuration</h3>
          <p>{error}</p>
          <p><strong>Expected directory:</strong> ~/.recipe/</p>
          <p><strong>Expected files:</strong> deployment.conf, overrides.conf</p>
        </div>
      </div>
    )
  }

  // Filter to show both deployment.conf and overrides.conf
  const deploymentConfig = configData.find(config => config.fileName === 'deployment.conf')
  const overridesConfig = configData.find(config => config.fileName === 'overrides.conf')

  // Process overrides config data
  const processedOverridesConfig = overridesConfig ? processConfigData(overridesConfig) : null

  return (
    <div className="recipe-config">
      <h2>Recipe Configuration Files</h2>
      <p className="config-path">Reading from: {directory}</p>

      <div className="config-files">
        {/* Deployment Configuration */}
        {deploymentConfig && (
          <div className="config-file">
            <h3 className="file-name">{deploymentConfig.fileName}</h3>

            {/* Search Input for filtering services */}
            <div className="search-container">
              <input
                type="text"
                placeholder="Search deployment services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button className="search-button" type="button">
                Search
              </button>
              {searchTerm && (
                <button
                  className="clear-button"
                  type="button"
                  onClick={() => setSearchTerm('')}
                >
                  Clear
                </button>
              )}
            </div>

            {deploymentConfig.error ? (
              <div className="file-error">
                <p>{deploymentConfig.error}</p>
                <p className="file-path">Expected at: {deploymentConfig.path}</p>
              </div>
            ) : (
              <>
                <div className="config-items">
                  {deploymentConfig.items.length > 0 ? (
                    deploymentConfig.items.map((item, itemIndex) => (
                      <div key={itemIndex}>
                        {/* Handle list values for deployment.services - show only the items */}
                        {Array.isArray(item.value) ? (
                          <div className="config-list">
                            {filterServices(item.value).map((listItem) => {
                              // Find the original index in the unfiltered array
                              const actualIndex = item.value.indexOf(listItem);
                              return (
                                <div key={actualIndex} className={`list-item ${listItem.startsWith('#') ? 'commented' : ''}`}>
                                  <span className="list-value">{listItem}</span>
                                  <div className="list-item-actions">
                                    <button
                                      className="action-btn comment-btn"
                                      onClick={() => handleCommentListItem(deploymentConfig.fileName, itemIndex, actualIndex)}
                                    >
                                      {listItem.startsWith('#') ? 'Uncomment' : 'Comment'}
                                    </button>
                                    <button
                                      className="action-btn delete-btn"
                                      onClick={() => handleDeleteListItem(deploymentConfig.fileName, itemIndex, actualIndex)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )
                            })}

                            {/* Show message when search has no results */}
                            {searchTerm && filterServices(item.value).length === 0 && (
                              <div className="no-results">
                                <p>No services found matching "{searchTerm}"</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={`config-item ${item.commented ? 'commented' : ''}`}>
                            <div className="config-content">
                              <span className="config-key">{item.key}</span>
                              <span className="config-separator">=</span>

                              {editingItem?.fileName === deploymentConfig.fileName && editingItem?.index === itemIndex ? (
                                <div className="edit-form">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="edit-input"
                                    autoFocus
                                  />
                                  <button className="save-btn" onClick={handleSaveEdit}>Save</button>
                                  <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                </div>
                              ) : (
                                <span className="config-value">{item.value}</span>
                              )}
                            </div>

                            {/* Actions for non-list items */}
                            <div className="config-actions">
                              <button
                                className="action-btn update-btn"
                                onClick={() => handleStartEdit(deploymentConfig.fileName, itemIndex, item.value as string)}
                              >
                                Update
                              </button>
                              <button
                                className="action-btn comment-btn"
                                onClick={() => handleCommentItem(deploymentConfig.fileName, itemIndex)}
                              >
                                {item.commented ? 'Uncomment' : 'Comment'}
                              </button>
                              <button
                                className="action-btn delete-btn"
                                onClick={() => handleDelete(deploymentConfig.fileName, itemIndex)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="empty-file">
                      <p>File is empty or contains no key=value pairs</p>
                    </div>
                  )}
                </div>

                {/* Add New Item Form */}
                {showAddForm === deploymentConfig.fileName ? (
                  <div className="add-item-form">
                    {/* Check if we're adding to a list (deployment.services) */}
                    {deploymentConfig.items.some(item => Array.isArray(item.value)) ? (
                      <>
                        <div className="form-inputs">
                          <input
                            type="text"
                            placeholder="Enter service name (e.g., auth, clearance, etc.)"
                            value={newListItem}
                            onChange={(e) => setNewListItem(e.target.value)}
                            className="value-input"
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div className="form-actions">
                          <button
                            className="save-btn"
                            onClick={() => {
                              const servicesIndex = deploymentConfig.items.findIndex(item => Array.isArray(item.value));
                              if (servicesIndex >= 0) {
                                handleAddListItem(deploymentConfig.fileName, servicesIndex);
                              }
                            }}
                          >
                            Add Service
                          </button>
                          <button
                            className="cancel-btn"
                            onClick={() => {
                              setShowAddForm(null)
                              setNewListItem('')
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-inputs">
                          <input
                            type="text"
                            placeholder="Key"
                            value={newItem.key}
                            onChange={(e) => setNewItem(prev => ({ ...prev, key: e.target.value }))}
                            className="key-input"
                          />
                          <span className="form-separator">=</span>
                          <input
                            type="text"
                            placeholder="Value"
                            value={newItem.value}
                            onChange={(e) => setNewItem(prev => ({ ...prev, value: e.target.value }))}
                            className="value-input"
                          />
                        </div>
                        <div className="form-actions">
                          <button
                            className="save-btn"
                            onClick={() => handleAddItem(deploymentConfig.fileName)}
                          >
                            Save
                          </button>
                          <button
                            className="cancel-btn"
                            onClick={() => {
                              setShowAddForm(null)
                              setNewItem({ key: '', value: '' })
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="action-buttons-container">
                    <button
                      className="add-item-btn"
                      onClick={() => setShowAddForm(deploymentConfig.fileName)}
                    >
                      Add New Element
                    </button>
                    <button
                      className="update-recipe-btn"
                      onClick={() => handleUpdateRecipe(deploymentConfig.fileName)}
                    >
                      Up Recipe
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Overrides Configuration */}
        {processedOverridesConfig && (
          <div className="config-file">
            <h3 className="file-name">{processedOverridesConfig.fileName}</h3>

            {/* Search Input for filtering overrides items */}
            <div className="search-container">
              <input
                type="text"
                placeholder="Search overrides items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button className="search-button" type="button">
                Search
              </button>
              {searchTerm && (
                <button
                  className="clear-button"
                  type="button"
                  onClick={() => setSearchTerm('')}
                >
                  Clear
                </button>
              )}
            </div>

            {processedOverridesConfig.error ? (
              <div className="file-error">
                <p>{processedOverridesConfig.error}</p>
                <p className="file-path">Expected at: {processedOverridesConfig.path}</p>
              </div>
            ) : (
              <>
                <div className="config-items">
                  {processedOverridesConfig.items.length > 0 ? (
                    filterOverridesItems(processedOverridesConfig.items).map((item) => {
                      // Find the original index in the unfiltered array
                      const itemIndex = processedOverridesConfig.items.indexOf(item);
                      return (
                        <div key={itemIndex}>
                          {/* Handle special objects */}
                          {item.isObject ? (
                            <div className="config-object">
                              <div className="object-header">
                                <span className="object-name">{item.key}</span>
                                <div className="object-actions">
                                  <button
                                    className="action-btn update-btn"
                                    onClick={() => handleStartEdit(processedOverridesConfig.fileName, itemIndex, item.value as string)}
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                              <div className="object-content">
                                {editingItem?.fileName === processedOverridesConfig.fileName && editingItem?.index === itemIndex ? (
                                  <div className="edit-form">
                                    <textarea
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="edit-textarea"
                                      rows={6}
                                      autoFocus
                                    />
                                    <div className="form-actions">
                                      <button className="save-btn" onClick={handleSaveEdit}>Save</button>
                                      <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <pre className="object-value">{item.value}</pre>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className={`config-item ${item.commented ? 'commented' : ''}`}>
                              <div className="config-content">
                                <span className="config-key">{item.key}</span>
                                <span className="config-separator">=</span>

                                {editingItem?.fileName === processedOverridesConfig.fileName && editingItem?.index === itemIndex ? (
                                  <div className="edit-form">
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="edit-input"
                                      autoFocus
                                    />
                                    <button className="save-btn" onClick={handleSaveEdit}>Save</button>
                                    <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                  </div>
                                ) : (
                                  <span className="config-value">{item.value}</span>
                                )}
                              </div>

                              {/* Actions for regular items */}
                              <div className="config-actions">
                                <button
                                  className="action-btn update-btn"
                                  onClick={() => handleStartEdit(processedOverridesConfig.fileName, itemIndex, item.value as string)}
                                >
                                  Update
                                </button>
                                <button
                                  className="action-btn comment-btn"
                                  onClick={() => handleCommentItem(processedOverridesConfig.fileName, itemIndex)}
                                >
                                  {item.commented ? 'Uncomment' : 'Comment'}
                                </button>
                                <button
                                  className="action-btn delete-btn"
                                  onClick={() => handleDelete(processedOverridesConfig.fileName, itemIndex)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="empty-file">
                      <p>File is empty or contains no key=value pairs</p>
                    </div>
                  )}

                  {/* Show message when search has no results */}
                  {searchTerm && filterOverridesItems(processedOverridesConfig.items).length === 0 && processedOverridesConfig.items.length > 0 && (
                    <div className="no-results">
                      <p>No items found matching "{searchTerm}"</p>
                    </div>
                  )}
                </div>

                {/* Add New Item Form for Overrides */}
                {showAddForm === processedOverridesConfig.fileName ? (
                  <div className="add-item-form">
                    <div className="form-inputs">
                      <input
                        type="text"
                        placeholder="Key"
                        value={newItem.key}
                        onChange={(e) => setNewItem(prev => ({ ...prev, key: e.target.value }))}
                        className="key-input"
                      />
                      <span className="form-separator">=</span>
                      <input
                        type="text"
                        placeholder="Value"
                        value={newItem.value}
                        onChange={(e) => setNewItem(prev => ({ ...prev, value: e.target.value }))}
                        className="value-input"
                      />
                    </div>
                    <div className="form-actions">
                      <button
                        className="save-btn"
                        onClick={() => handleAddItem(processedOverridesConfig.fileName)}
                      >
                        Save
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={() => {
                          setShowAddForm(null)
                          setNewItem({ key: '', value: '' })
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="action-buttons-container">
                    <button
                      className="add-item-btn"
                      onClick={() => setShowAddForm(processedOverridesConfig.fileName)}
                    >
                      Add New Element
                    </button>
                    <button
                      className="update-recipe-btn"
                      onClick={() => handleUpdateRecipe(processedOverridesConfig.fileName)}
                    >
                      Save Overrides
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation?.show && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete service <strong>{deleteConfirmation.serviceName}</strong>?</p>
            <div className="confirmation-actions">
              <button
                className="confirm-yes-btn"
                onClick={confirmDelete}
              >
                Yes
              </button>
              <button
                className="confirm-no-btn"
                onClick={cancelDelete}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast?.show && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'error' && (
            <button
              className="toast-close"
              onClick={hideToast}
            >
              ×
            </button>
          )}
          <div className="toast-content">
            <span className="toast-icon">
              {toast.type === 'success' ? '✓' : '✕'}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecipeConfig
