import React, { useEffect, useState } from 'react';
import './ImagesPage.css';
import Dialog from './Dialog';

interface DockerImage {
  repository: string;
  tag: string;
  imageId: string;
  created: string;
  size: string;
}

interface DialogState {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  type: 'confirm' | 'info' | 'success' | 'error';
  confirmLabel: string;
  showCancel: boolean;
  onConfirm: () => void;
}

const ImagesPage: React.FC = () => {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingDanglings, setDeletingDanglings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog state
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    confirmLabel: 'Confirm',
    showCancel: true,
    onConfirm: () => { },
  });

  useEffect(() => {
    fetchImages();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredImages(images);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = images.filter(img => 
        img.repository.toLowerCase().includes(term) || 
        img.tag.toLowerCase().includes(term) ||
        img.imageId.toLowerCase().includes(term)
      );
      setFilteredImages(filtered);
    }
  }, [searchTerm, images]);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/docker/images');
      const data = await res.json();
      if (data.success) {
        setImages(data.data);
        setFilteredImages(data.data);
      } else {
        setError(data.error || 'Failed to fetch images');
      }
    } catch (err) {
      setError('Failed to connect to backend');
    }
    setLoading(false);
  };

  const handleDeleteClick = () => {
    setDialog({
      isOpen: true,
      title: 'Delete Dangling Images',
      message: 'Are you sure you want to delete all dangling images? This action cannot be undone.',
      type: 'confirm',
      confirmLabel: 'Delete',
      showCancel: true,
      onConfirm: deleteDanglingImages,
    });
  };

  const closeDialog = () => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  const deleteDanglingImages = async () => {
    closeDialog();
    setDeletingDanglings(true);

    try {
      const res = await fetch('http://localhost:3001/api/docker/images/dangling', {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        // Process stdout to get list of deleted images
        const deletedImages = data.stdout
          ? data.stdout
            .trim()
            .split('\n')
            .filter((line: string) => line.includes('Deleted:') || line.includes('Untagged:'))
          : [];

        // Show success dialog with deleted images
        setDialog({
          isOpen: true,
          title: 'Images Deleted Successfully',
          message: (
            <>
              <p>{data.message}</p>
              {deletedImages.length > 0 && (
                <div className="deleted-images">
                  {deletedImages.map((line: string, index: number) => (
                    <div key={index} className="deleted-image">{line}</div>
                  ))}
                </div>
              )}
            </>
          ),
          type: 'success',
          confirmLabel: 'Okay',
          showCancel: false,
          onConfirm: () => {
            closeDialog();
            fetchImages(); // Refresh images list
          },
        });
      } else {
        // Show error dialog
        setDialog({
          isOpen: true,
          title: 'Error',
          message: data.error || 'Failed to delete dangling images',
          type: 'error',
          confirmLabel: 'Okay',
          showCancel: false,
          onConfirm: closeDialog,
        });
      }
    } catch (err) {
      // Show network error dialog
      setDialog({
        isOpen: true,
        title: 'Network Error',
        message: 'Failed to connect to backend server',
        type: 'error',
        confirmLabel: 'Okay',
        showCancel: false,
        onConfirm: closeDialog,
      });
    } finally {
      setDeletingDanglings(false);
    }
  };

  // Function to handle individual image deletion
  const handleDeleteImage = async (imageId: string) => {
    setDialog({
      isOpen: true,
      title: 'Delete Image',
      message: `Are you sure you want to delete image ${imageId}? This action cannot be undone.`,
      type: 'confirm',
      confirmLabel: 'Delete',
      showCancel: true,
      onConfirm: () => confirmDeleteImage(imageId),
    });
  };

  const confirmDeleteImage = async (imageId: string) => {
    closeDialog();

    try {
      const res = await fetch(`http://localhost:3001/api/docker/images/${imageId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        // Show success message
        setDialog({
          isOpen: true,
          title: 'Image Deleted',
          message: data.message,
          type: 'success',
          confirmLabel: 'Okay',
          showCancel: false,
          onConfirm: () => {
            closeDialog();
            fetchImages(); // Refresh images list
          },
        });
      } else {
        // Show error dialog
        setDialog({
          isOpen: true,
          title: 'Error',
          message: data.error || 'Failed to delete image',
          type: 'error',
          confirmLabel: 'Okay',
          showCancel: false,
          onConfirm: closeDialog,
        });
      }
    } catch (err) {
      // Show network error dialog
      setDialog({
        isOpen: true,
        title: 'Network Error',
        message: 'Failed to connect to backend server',
        type: 'error',
        confirmLabel: 'Okay',
        showCancel: false,
        onConfirm: closeDialog,
      });
    }
  };

  // Helper function to check if an image is dangling
  const isDanglingImage = (image: DockerImage): boolean => {
    return image.repository === '<none>' || image.tag === '<none>';
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <div className="images-page">
      <div className="images-count">
        <div className="controls-section">
          <h2>Docker Images</h2>
          
          <div className="search-bar-container">
            <input 
              type="text" 
              className="search-input"
              placeholder="Search images..."
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
              ? `Found ${filteredImages.length} images matching "${searchTerm}"`
              : `Showing ${images.length} Docker images`
            }
          </div>
          
          <button
            className="delete-danglings-btn"
            onClick={handleDeleteClick}
            disabled={deletingDanglings || loading}
          >
            {deletingDanglings ? 'Deleting...' : 'Delete Danglings'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={fetchImages}>Retry</button>
        </div>
      )}

      {loading && (
        <div className="loading-message">
          <p>Loading images...</p>
        </div>
      )}

      {!loading && !error && (
        <div className="images-table-wrapper">
          {filteredImages.length > 0 ? (
            <>
              <table className="images-table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Tag</th>
                    <th>Image ID</th>
                    <th>Created</th>
                    <th>Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredImages.map((img, idx) => (
                    <tr
                      key={img.imageId + idx}
                      className={isDanglingImage(img) ? 'dangling-image' : ''}
                    >
                      <td className="repository">
                        {img.repository === '<none>' ? (
                          <span className="dangling-text">{img.repository}</span>
                        ) : (
                          img.repository
                        )}
                      </td>
                      <td className="tag">
                        {img.tag === '<none>' ? (
                          <span className="dangling-text">{img.tag}</span>
                        ) : (
                          img.tag
                        )}
                      </td>
                      <td className="image-id">{img.imageId}</td>
                      <td className="created">{img.created}</td>
                      <td className="size">{img.size}</td>
                      <td className="actions">
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteImage(img.imageId)}
                          title="Delete Image"
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
            <div className="no-images">
              {searchTerm ? (
                <>
                  <p>No images found matching "{searchTerm}"</p>
                  <button onClick={clearSearch} className="clear-search-btn">Clear Search</button>
                </>
              ) : (
                <>
                  <p>No Docker images found</p>
                  <button onClick={fetchImages} className="retry-btn">Refresh</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        confirmLabel={dialog.confirmLabel}
        showCancel={dialog.showCancel}
        onConfirm={dialog.onConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
};

export default ImagesPage;