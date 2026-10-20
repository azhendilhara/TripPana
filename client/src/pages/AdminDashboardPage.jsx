import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';

function AdminDashboardPage({ initialTab = 'dashboard' }) {
  const navigate = useNavigate();

  const [adminToken, setAdminToken] = useState(() => {
    return localStorage.getItem('tripPanaAdminToken') || '';
  });
  const [adminUser, setAdminUser] = useState(() => {
    const saved = localStorage.getItem('tripPanaAdminUser');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState(initialTab); // 'dashboard' | 'places' | 'categories' | 'reviews'
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Dashboard Stats
  const [stats, setStats] = useState({
    total_places: 0,
    total_categories: 0,
    total_users: 0,
    total_itineraries: 0,
    pending_reviews: 0,
    approved_reviews: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Places state
  const [places, setPlaces] = useState([]);
  const [placeSearch, setPlaceSearch] = useState('');
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState(null);
  const [placeForm, setPlaceForm] = useState({
    title: '',
    category_id: '',
    description: '',
    location: '',
    address: '',
    latitude: '',
    longitude: '',
    opening_hours: '',
    entry_fee: '',
    distance_from_panadura: '',
    travel_tips: '',
    image_url: ''
  });

  // Multiple Images Management State
  const [selectedImageFiles, setSelectedImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingPlaceImages, setExistingPlaceImages] = useState([]);
  const [loadingPlaceImages, setLoadingPlaceImages] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  });

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewFilter, setReviewFilter] = useState('pending');
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Global action feedback
  const [notification, setNotification] = useState({ type: '', message: '' });

  const showNotify = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: '', message: '' }), 4000);
  };

  // Guard: if not authenticated as admin, redirect to admin login
  useEffect(() => {
    if (!adminToken) {
      navigate('/admin/login');
    }
  }, [adminToken, navigate]);

  const handleAdminLogout = () => {
    localStorage.removeItem('tripPanaAdminToken');
    localStorage.removeItem('tripPanaAdminUser');
    setAdminToken('');
    setAdminUser(null);
    navigate('/admin/login');
  };

  // Fetch Dashboard Stats
  const fetchStats = async () => {
    if (!adminToken) return;
    try {
      setLoadingStats(true);
      const res = await fetch('http://localhost:5000/api/admin/stats', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleAdminLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch Places
  const fetchPlaces = async () => {
    try {
      setLoadingPlaces(true);
      const res = await fetch('http://localhost:5000/api/places');
      if (res.ok) {
        const data = await res.json();
        setPlaces(data);
      }
    } catch (err) {
      console.error('Error fetching places:', err);
    } finally {
      setLoadingPlaces(false);
    }
  };

  // Fetch Categories
  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch('http://localhost:5000/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Fetch Reviews
  const fetchReviews = async (status = reviewFilter) => {
    if (!adminToken) return;
    try {
      setLoadingReviews(true);
      const url =
        status === 'all'
          ? 'http://localhost:5000/api/admin/reviews?status=all'
          : `http://localhost:5000/api/admin/reviews?status=${status}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Load initial data
  useEffect(() => {
    if (adminToken) {
      fetchStats();
      fetchPlaces();
      fetchCategories();
      fetchReviews(reviewFilter);
    }
  }, [adminToken]);

  // Tab switch refresher
  useEffect(() => {
    if (activeTab === 'dashboard') fetchStats();
    if (activeTab === 'places') fetchPlaces();
    if (activeTab === 'categories') fetchCategories();
    if (activeTab === 'reviews') fetchReviews(reviewFilter);
  }, [activeTab]);

  // =====================================================
  // PLACE ACTIONS & IMAGE MANAGEMENT
  // =====================================================

  const fetchPlaceImages = async (placeId) => {
    try {
      setLoadingPlaceImages(true);
      const res = await fetch(`http://localhost:5000/api/places/${placeId}/images`);
      if (res.ok) {
        const data = await res.json();
        setExistingPlaceImages(data);
      }
    } catch (err) {
      console.error('Error fetching place images:', err);
    } finally {
      setLoadingPlaceImages(false);
    }
  };

  const openAddPlaceModal = () => {
    setEditingPlace(null);
    setPlaceForm({
      title: '',
      category_id: categories.length > 0 ? categories[0].category_id : '',
      description: '',
      location: '',
      address: '',
      latitude: '',
      longitude: '',
      opening_hours: '',
      entry_fee: '',
      distance_from_panadura: '',
      travel_tips: '',
      image_url: ''
    });
    setSelectedImageFiles([]);
    setImagePreviews([]);
    setExistingPlaceImages([]);
    setShowPlaceModal(true);
  };

  const openEditPlaceModal = (place) => {
    setEditingPlace(place);
    setPlaceForm({
      title: place.title || '',
      category_id: place.category_id || '',
      description: place.description || '',
      location: place.location || '',
      address: place.address || '',
      latitude: place.latitude !== null ? place.latitude : '',
      longitude: place.longitude !== null ? place.longitude : '',
      opening_hours: place.opening_hours || '',
      entry_fee: place.entry_fee || '',
      distance_from_panadura: place.distance_from_panadura !== null ? place.distance_from_panadura : '',
      travel_tips: place.travel_tips || '',
      image_url: place.image_url || ''
    });
    setSelectedImageFiles([]);
    setImagePreviews([]);
    setExistingPlaceImages([]);
    fetchPlaceImages(place.place_id);
    setShowPlaceModal(true);
  };

  const handleFileSelection = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const validFiles = [];
    const newPreviews = [];

    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showNotify('error', `"${file.name}" is not a supported format. Please select JPEG, PNG, or WebP.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showNotify('error', `"${file.name}" exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        continue;
      }
      validFiles.push(file);
      newPreviews.push({
        url: URL.createObjectURL(file),
        name: file.name,
        size: (file.size / 1024).toFixed(0) + ' KB'
      });
    }

    setSelectedImageFiles((prev) => [...prev, ...validFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeSelectedFile = (index) => {
    setSelectedImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimary = async (imageId) => {
    if (!editingPlace) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/places/${editingPlace.place_id}/images/${imageId}/primary`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to set primary image.');

      showNotify('success', 'Primary image updated.');
      fetchPlaceImages(editingPlace.place_id);
      fetchPlaces();
    } catch (err) {
      showNotify('error', err.message);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!editingPlace) return;
    if (!window.confirm('Are you sure you want to delete this image?')) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/places/${editingPlace.place_id}/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete image.');

      showNotify('success', 'Image deleted.');
      fetchPlaceImages(editingPlace.place_id);
      fetchPlaces();
    } catch (err) {
      showNotify('error', err.message);
    }
  };

  const handleSavePlace = async (e) => {
    e.preventDefault();

    if (!placeForm.title.trim()) {
      showNotify('error', 'Place title is required.');
      return;
    }

    try {
      setIsUploadingImages(true);

      const payload = {
        ...placeForm,
        category_id: placeForm.category_id ? Number(placeForm.category_id) : null,
        latitude: placeForm.latitude ? Number(placeForm.latitude) : null,
        longitude: placeForm.longitude ? Number(placeForm.longitude) : null,
        distance_from_panadura: placeForm.distance_from_panadura ? Number(placeForm.distance_from_panadura) : null
      };

      const url = editingPlace
        ? `http://localhost:5000/api/places/${editingPlace.place_id}`
        : 'http://localhost:5000/api/places';

      const method = editingPlace ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save place.');
      }

      const targetPlaceId = editingPlace ? editingPlace.place_id : data.place_id;

      // If new image files were selected, upload them now
      if (selectedImageFiles.length > 0 && targetPlaceId) {
        const formData = new FormData();
        selectedImageFiles.forEach((file) => formData.append('images', file));

        const uploadRes = await fetch(`http://localhost:5000/api/admin/places/${targetPlaceId}/images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`
          },
          body: formData
        });

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json();
          showNotify('error', `Place saved, but image upload failed: ${uploadErr.message}`);
        }
      }

      showNotify('success', editingPlace ? 'Place updated successfully.' : 'Place created successfully.');
      setShowPlaceModal(false);
      setSelectedImageFiles([]);
      setImagePreviews([]);
      fetchPlaces();
      fetchStats();
    } catch (err) {
      showNotify('error', err.message);
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleDeletePlace = async (placeId, title) => {
    if (!window.confirm(`Are you sure you want to permanently delete place "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/places/${placeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete place.');
      }

      showNotify('success', `Place "${title}" deleted.`);
      fetchPlaces();
      fetchStats();
    } catch (err) {
      showNotify('error', err.message);
    }
  };

  // =====================================================
  // CATEGORY ACTIONS
  // =====================================================

  const openAddCategoryModal = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name || '', description: cat.description || '' });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();

    if (!categoryForm.name.trim()) {
      showNotify('error', 'Category name is required.');
      return;
    }

    try {
      const url = editingCategory
        ? `http://localhost:5000/api/categories/${editingCategory.category_id}`
        : 'http://localhost:5000/api/categories';

      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save category.');
      }

      showNotify('success', editingCategory ? 'Category updated.' : 'Category created.');
      setShowCategoryModal(false);
      fetchCategories();
      fetchStats();
    } catch (err) {
      showNotify('error', err.message);
    }
  };

  const handleDeleteCategory = async (catId, name, placeCount) => {
    if (placeCount > 0) {
      alert(`Cannot delete category "${name}": it is currently assigned to ${placeCount} place(s). Please reassign or delete those places first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/categories/${catId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete category.');
      }

      showNotify('success', `Category "${name}" deleted.`);
      fetchCategories();
      fetchStats();
    } catch (err) {
      showNotify('error', err.message);
    }
  };

  // =====================================================
  // REVIEW ACTIONS
  // =====================================================

  const handleUpdateReviewStatus = async (reviewId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/reviews/${reviewId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update review status.');
      }

      showNotify('success', `Review #${reviewId} marked as ${newStatus}.`);
      fetchReviews(reviewFilter);
      fetchStats();
    } catch (err) {
      showNotify('error', err.message);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm(`Are you sure you want to permanently delete review #${reviewId}?`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete review.');
      }

      showNotify('success', `Review #${reviewId} deleted.`);
      fetchReviews(reviewFilter);
      fetchStats();
    } catch (err) {
      showNotify('error', err.message);
    }
  };

  const filteredPlaces = places.filter((p) => {
    if (!placeSearch) return true;
    const q = placeSearch.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-app-layout">
      {/* Mobile Top Header */}
      <header className="admin-mobile-header">
        <div className="admin-mobile-brand">
          <Link to="/" className="admin-brand-link">
            Trip<span className="brand-accent">Pana</span>
          </Link>
          <span className="admin-tag-pill">ADMIN</span>
        </div>
        <button
          type="button"
          className="admin-hamburger-btn"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileSidebarOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Fixed / Sticky Left Sidebar */}
      <aside className={`admin-sidebar ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Header */}
        <div className="admin-sidebar-brand">
          <Link to="/" className="admin-brand-link">
            Trip<span className="brand-accent">Pana</span>
          </Link>
          <span className="admin-tag-pill">ADMIN</span>
        </div>

        {/* Sidebar Navigation */}
        <div className="admin-sidebar-nav-container">
          <div className="admin-nav-section-title">MANAGEMENT</div>
          <ul className="admin-sidebar-menu">
            <li>
              <button
                type="button"
                className={`admin-menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('dashboard');
                  setMobileSidebarOpen(false);
                }}
              >
                <span className="admin-menu-icon">📊</span>
                <span className="admin-menu-text">Dashboard</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`admin-menu-item ${activeTab === 'places' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('places');
                  setMobileSidebarOpen(false);
                }}
              >
                <span className="admin-menu-icon">📍</span>
                <span className="admin-menu-text">Places</span>
                <span className="admin-menu-pill">{places.length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`admin-menu-item ${activeTab === 'categories' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('categories');
                  setMobileSidebarOpen(false);
                }}
              >
                <span className="admin-menu-icon">🏷️</span>
                <span className="admin-menu-text">Categories</span>
                <span className="admin-menu-pill">{categories.length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`admin-menu-item ${activeTab === 'reviews' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('reviews');
                  setMobileSidebarOpen(false);
                }}
              >
                <span className="admin-menu-icon">💬</span>
                <span className="admin-menu-text">Reviews</span>
                {stats.pending_reviews > 0 && (
                  <span className="admin-menu-pill pill-alert">
                    {stats.pending_reviews}
                  </span>
                )}
              </button>
            </li>
          </ul>
        </div>

        {/* Sidebar Footer Section */}
        <div className="admin-sidebar-footer">
          <Link
            to="/"
            target="_blank"
            rel="noreferrer"
            className="admin-public-link"
          >
            <span>↗</span> Public Website
          </Link>

          <div className="admin-user-card">
            <div className="admin-avatar">
              {(adminUser?.username?.[0] || 'A').toUpperCase()}
            </div>
            <div className="admin-user-details">
              <span className="admin-user-name">{adminUser?.username || 'admin'}</span>
              <span className="admin-user-role">Administrator</span>
            </div>
          </div>

          <button
            type="button"
            className="admin-logout-button"
            onClick={handleAdminLogout}
          >
            <span className="logout-icon">🚪</span>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area on the right */}
      <div className="admin-main-wrapper">
        {/* Notification Toast */}
        {notification.message && (
          <div
            className={`admin-toast ${
              notification.type === 'error' ? 'toast-error' : 'toast-success'
            }`}
            role="alert"
          >
            <span className="toast-icon">{notification.type === 'error' ? '⚠️' : '✓'}</span>
            <span>{notification.message}</span>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-breadcrumb">
            <span className="breadcrumb-root">Admin</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">
              {activeTab === 'dashboard'
                ? 'Dashboard'
                : activeTab === 'places'
                ? 'Places & Attractions'
                : activeTab === 'categories'
                ? 'Categories'
                : 'Reviews Moderation'}
            </span>
          </div>

          <div className="admin-topbar-actions">
            {activeTab === 'dashboard' && (
              <button
                type="button"
                className="btn-admin-refresh"
                onClick={fetchStats}
                disabled={loadingStats}
              >
                <span className={loadingStats ? 'spin-icon' : ''}>🔄</span>
                <span>{loadingStats ? 'Refreshing...' : 'Refresh Stats'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Tab Panes */}
        <main className="admin-content-area">
          {/* ===============================================
              TAB 1: DASHBOARD OVERVIEW
              =============================================== */}
          {activeTab === 'dashboard' && (
            <div className="admin-pane">
              <div className="admin-page-header">
                <div>
                  <h1 className="admin-page-title">Dashboard</h1>
                  <p className="admin-page-subtitle">
                    Real-time overview of TripPana attractions, categories, tourists, and moderation queue.
                  </p>
                </div>
              </div>

              {/* 6 Responsive KPI Cards */}
              <div className="admin-kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-icon-wrap icon-teal">📍</div>
                  <div className="kpi-info">
                    <span className="kpi-label">Total Places</span>
                    <strong className="kpi-number">{stats.total_places}</strong>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-wrap icon-cyan">🏷️</div>
                  <div className="kpi-info">
                    <span className="kpi-label">Categories</span>
                    <strong className="kpi-number">{stats.total_categories}</strong>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-wrap icon-blue">👥</div>
                  <div className="kpi-info">
                    <span className="kpi-label">Registered Tourists</span>
                    <strong className="kpi-number">{stats.total_users}</strong>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-wrap icon-teal-dark">🗺️</div>
                  <div className="kpi-info">
                    <span className="kpi-label">Saved Itineraries</span>
                    <strong className="kpi-number">{stats.total_itineraries}</strong>
                  </div>
                </div>

                <div className={`kpi-card ${stats.pending_reviews > 0 ? 'kpi-card-alert' : ''}`}>
                  <div className="kpi-icon-wrap icon-orange">⏳</div>
                  <div className="kpi-info">
                    <span className="kpi-label">Pending Reviews</span>
                    <strong className="kpi-number">{stats.pending_reviews}</strong>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-wrap icon-green">⭐</div>
                  <div className="kpi-info">
                    <span className="kpi-label">Approved Reviews</span>
                    <strong className="kpi-number">{stats.approved_reviews}</strong>
                  </div>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="admin-card quick-actions-panel">
                <h3 className="card-section-title">Quick Management Actions</h3>
                <div className="quick-action-buttons">
                  <button
                    type="button"
                    className="btn-quick-action"
                    onClick={() => {
                      setActiveTab('places');
                      openAddPlaceModal();
                    }}
                  >
                    <span className="btn-icon">＋</span> Add New Place
                  </button>

                  <button
                    type="button"
                    className="btn-quick-action"
                    onClick={() => {
                      setActiveTab('categories');
                      openAddCategoryModal();
                    }}
                  >
                    <span className="btn-icon">＋</span> Add New Category
                  </button>

                  <button
                    type="button"
                    className="btn-quick-action action-accent"
                    onClick={() => {
                      setActiveTab('reviews');
                      setReviewFilter('pending');
                    }}
                  >
                    <span className="btn-icon">💬</span> Moderate Pending Reviews ({stats.pending_reviews})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================
              TAB 2: PLACES MANAGEMENT
              =============================================== */}
          {activeTab === 'places' && (
            <div className="admin-pane">
              <div className="admin-page-header">
                <div>
                  <h1 className="admin-page-title">Places & Attractions</h1>
                  <p className="admin-page-subtitle">
                    Add, edit, and organize places of interest around Panadura.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-brand-primary"
                  onClick={openAddPlaceModal}
                >
                  ＋ Add New Place
                </button>
              </div>

              {/* Filter Search */}
              <div className="admin-toolbar">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search places by title, location or category..."
                    value={placeSearch}
                    onChange={(e) => setPlaceSearch(e.target.value)}
                  />
                  {placeSearch && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => setPlaceSearch('')}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="toolbar-stats">
                  Showing <strong>{filteredPlaces.length}</strong> of {places.length} places
                </div>
              </div>

              {loadingPlaces ? (
                <div className="admin-loading-state">
                  <span className="loading-spinner"></span>
                  <p>Loading attractions from database...</p>
                </div>
              ) : filteredPlaces.length === 0 ? (
                <div className="admin-empty-state">
                  <div className="empty-icon">📍</div>
                  <h3>No places found</h3>
                  <p>Try adjusting your search criteria or add a new place.</p>
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-modern-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>ID</th>
                        <th style={{ width: '70px' }}>Photo</th>
                        <th>Place Name</th>
                        <th>Category</th>
                        <th>Location</th>
                        <th>Distance</th>
                        <th>Entry Fee</th>
                        <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlaces.map((place) => (
                        <tr key={place.place_id}>
                          <td>
                            <span className="id-tag">#{place.place_id}</span>
                          </td>
                          <td>
                            <img
                              src={place.image_url || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'}
                              alt={place.title}
                              className="table-thumbnail"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee';
                              }}
                            />
                          </td>
                          <td>
                            <div className="place-title-cell">
                              <strong className="place-title-text">{place.title}</strong>
                              {place.address && (
                                <span className="place-address-sub">{place.address}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="badge-category">{place.category || 'Uncategorized'}</span>
                          </td>
                          <td>
                            <span className="place-location-text">📍 {place.location || 'Panadura'}</span>
                          </td>
                          <td>
                            {place.distance_from_panadura !== null
                              ? `${place.distance_from_panadura} km`
                              : '-'}
                          </td>
                          <td>
                            <span className="badge-fee">{place.entry_fee || 'Free'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="table-actions-group">
                              <button
                                type="button"
                                className="btn-table-action btn-edit"
                                onClick={() => openEditPlaceModal(place)}
                                title="Edit Place"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                className="btn-table-action btn-delete"
                                onClick={() => handleDeletePlace(place.place_id, place.title)}
                                title="Delete Place"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ===============================================
              TAB 3: CATEGORIES MANAGEMENT
              =============================================== */}
          {activeTab === 'categories' && (
            <div className="admin-pane">
              <div className="admin-page-header">
                <div>
                  <h1 className="admin-page-title">Categories</h1>
                  <p className="admin-page-subtitle">
                    Manage classification categories used on the homepage and itinerary planner.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-brand-primary"
                  onClick={openAddCategoryModal}
                >
                  ＋ Add New Category
                </button>
              </div>

              {loadingCategories ? (
                <div className="admin-loading-state">
                  <span className="loading-spinner"></span>
                  <p>Loading categories...</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="admin-empty-state">
                  <div className="empty-icon">🏷️</div>
                  <h3>No categories found</h3>
                  <p>Create a category to begin classifying places.</p>
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-modern-table">
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>ID</th>
                        <th style={{ width: '220px' }}>Category Name</th>
                        <th>Description</th>
                        <th style={{ width: '160px' }}>Places Assigned</th>
                        <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr key={cat.category_id}>
                          <td>
                            <span className="id-tag">#{cat.category_id}</span>
                          </td>
                          <td>
                            <strong className="category-name-cell">{cat.name}</strong>
                          </td>
                          <td>
                            <span className="category-desc-cell">
                              {cat.description || <em className="text-muted">No description provided</em>}
                            </span>
                          </td>
                          <td>
                            <span className={`badge-place-count ${cat.place_count > 0 ? 'has-places' : 'no-places'}`}>
                              {cat.place_count || 0} place{cat.place_count === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="table-actions-group">
                              <button
                                type="button"
                                className="btn-table-action btn-edit"
                                onClick={() => openEditCategoryModal(cat)}
                                title="Edit Category"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                className="btn-table-action btn-delete"
                                onClick={() => handleDeleteCategory(cat.category_id, cat.name, cat.place_count)}
                                title={
                                  cat.place_count > 0
                                    ? `Cannot delete: currently assigned to ${cat.place_count} places`
                                    : 'Delete Category'
                                }
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ===============================================
              TAB 4: REVIEWS MODERATION
              =============================================== */}
          {activeTab === 'reviews' && (
            <div className="admin-pane">
              <div className="admin-page-header">
                <div>
                  <h1 className="admin-page-title">Review Moderation</h1>
                  <p className="admin-page-subtitle">
                    Review and moderate tourist feedback before publishing to the public site.
                  </p>
                </div>
              </div>

              {/* Moderation Filter Tabs */}
              <div className="review-filter-bar">
                <button
                  type="button"
                  className={`filter-tab-pill ${reviewFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => {
                    setReviewFilter('pending');
                    fetchReviews('pending');
                  }}
                >
                  Pending ({stats.pending_reviews})
                </button>
                <button
                  type="button"
                  className={`filter-tab-pill ${reviewFilter === 'approved' ? 'active' : ''}`}
                  onClick={() => {
                    setReviewFilter('approved');
                    fetchReviews('approved');
                  }}
                >
                  Approved
                </button>
                <button
                  type="button"
                  className={`filter-tab-pill ${reviewFilter === 'rejected' ? 'active' : ''}`}
                  onClick={() => {
                    setReviewFilter('rejected');
                    fetchReviews('rejected');
                  }}
                >
                  Rejected
                </button>
                <button
                  type="button"
                  className={`filter-tab-pill ${reviewFilter === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setReviewFilter('all');
                    fetchReviews('all');
                  }}
                >
                  All Reviews
                </button>
              </div>

              {loadingReviews ? (
                <div className="admin-loading-state">
                  <span className="loading-spinner"></span>
                  <p>Loading reviews...</p>
                </div>
              ) : reviews.length === 0 ? (
                <div className="admin-empty-state">
                  <div className="empty-icon">💬</div>
                  <h3>No {reviewFilter !== 'all' ? reviewFilter : ''} reviews</h3>
                  <p>All reviews under this filter have been addressed.</p>
                </div>
              ) : (
                <div className="reviews-moderation-grid">
                  {reviews.map((rev) => (
                    <div key={rev.review_id} className="review-moderation-card">
                      <div className="card-top-row">
                        <div className="review-meta">
                          <span className="id-tag">#{rev.review_id}</span>
                          <h3 className="target-place-title">
                            <Link to={`/places/${rev.place_id}`} target="_blank" rel="noreferrer">
                              {rev.place_title} ↗
                            </Link>
                          </h3>
                        </div>

                        <span className={`status-pill pill-${rev.status}`}>
                          {rev.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="reviewer-author-row">
                        <div className="author-avatar">
                          {(rev.user_name?.[0] || 'T').toUpperCase()}
                        </div>
                        <div className="author-info">
                          <strong>{rev.user_name}</strong>
                          <span className="author-email">{rev.user_email}</span>
                        </div>
                        <span className="review-date">
                          {new Date(rev.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="stars-rating-row">
                        <span className="stars-gold">
                          {'★'.repeat(rev.rating)}
                          {'☆'.repeat(5 - rev.rating)}
                        </span>
                        <span className="score-num">({rev.rating} / 5)</span>
                      </div>

                      <div className="comment-quote-box">
                        <p className="comment-text">&ldquo;{rev.comment}&rdquo;</p>
                      </div>

                      <div className="moderation-actions-row">
                        {rev.status !== 'approved' && (
                          <button
                            type="button"
                            className="btn-mod-approve"
                            onClick={() => handleUpdateReviewStatus(rev.review_id, 'approved')}
                          >
                            ✓ Approve
                          </button>
                        )}

                        {rev.status !== 'rejected' && (
                          <button
                            type="button"
                            className="btn-mod-reject"
                            onClick={() => handleUpdateReviewStatus(rev.review_id, 'rejected')}
                          >
                            ✕ Reject
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-mod-delete"
                          onClick={() => handleDeleteReview(rev.review_id)}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ===============================================
          MODAL: ADD / EDIT PLACE
          =============================================== */}
      {showPlaceModal && (
        <div className="admin-modal-overlay" onClick={() => setShowPlaceModal(false)}>
          <div className="admin-modal-card modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar">
              <h3 className="modal-title">{editingPlace ? 'Edit Attraction' : 'Add New Attraction'}</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowPlaceModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlace} className="admin-modal-form">
              <div className="form-fields-grid">
                <div className="form-field span-2">
                  <label htmlFor="pTitle">Place Title *</label>
                  <input
                    id="pTitle"
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. Panadura Beach"
                    value={placeForm.title}
                    onChange={(e) => setPlaceForm({ ...placeForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pCategory">Category</label>
                  <select
                    id="pCategory"
                    className="admin-form-select"
                    value={placeForm.category_id}
                    onChange={(e) => setPlaceForm({ ...placeForm, category_id: e.target.value })}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field span-3">
                  <label htmlFor="pDesc">Description</label>
                  <textarea
                    id="pDesc"
                    rows="3"
                    className="admin-form-textarea"
                    placeholder="Detailed description of the attraction..."
                    value={placeForm.description}
                    onChange={(e) => setPlaceForm({ ...placeForm, description: e.target.value })}
                  ></textarea>
                </div>

                <div className="form-field span-2">
                  <label htmlFor="pLoc">Location Area</label>
                  <input
                    id="pLoc"
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. Panadura Town"
                    value={placeForm.location}
                    onChange={(e) => setPlaceForm({ ...placeForm, location: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pDist">Distance from Panadura (km)</label>
                  <input
                    id="pDist"
                    type="number"
                    step="0.1"
                    className="admin-form-input"
                    placeholder="1.0"
                    value={placeForm.distance_from_panadura}
                    onChange={(e) =>
                      setPlaceForm({ ...placeForm, distance_from_panadura: e.target.value })
                    }
                  />
                </div>

                <div className="form-field span-3">
                  <label htmlFor="pAddr">Full Address</label>
                  <input
                    id="pAddr"
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. Galle Road, Panadura"
                    value={placeForm.address}
                    onChange={(e) => setPlaceForm({ ...placeForm, address: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pLat">Latitude</label>
                  <input
                    id="pLat"
                    type="number"
                    step="any"
                    className="admin-form-input"
                    placeholder="6.7132"
                    value={placeForm.latitude}
                    onChange={(e) => setPlaceForm({ ...placeForm, latitude: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pLng">Longitude</label>
                  <input
                    id="pLng"
                    type="number"
                    step="any"
                    className="admin-form-input"
                    placeholder="79.9025"
                    value={placeForm.longitude}
                    onChange={(e) => setPlaceForm({ ...placeForm, longitude: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pFee">Entry Fee</label>
                  <input
                    id="pFee"
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. Free or LKR 500"
                    value={placeForm.entry_fee}
                    onChange={(e) => setPlaceForm({ ...placeForm, entry_fee: e.target.value })}
                  />
                </div>

                <div className="form-field span-3">
                  <label htmlFor="pHours">Opening Hours</label>
                  <input
                    id="pHours"
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. 06:00 AM - 08:00 PM Daily"
                    value={placeForm.opening_hours}
                    onChange={(e) => setPlaceForm({ ...placeForm, opening_hours: e.target.value })}
                  />
                </div>

                <div className="form-field span-3">
                  <label htmlFor="pTips">Travel Tips</label>
                  <textarea
                    id="pTips"
                    rows="2"
                    className="admin-form-textarea"
                    placeholder="Visitor advice, dress code, best times to visit..."
                    value={placeForm.travel_tips}
                    onChange={(e) => setPlaceForm({ ...placeForm, travel_tips: e.target.value })}
                  ></textarea>
                </div>

                {/* Images Upload & Management Section */}
                <div className="form-field span-3 form-images-container">
                  <div className="images-section-header">
                    <label>Attraction Images</label>
                    <span className="images-section-subtitle">
                      Upload photos directly from your computer (JPEG, PNG, WebP — max 5 MB each)
                    </span>
                  </div>

                  {/* Existing Images when Editing */}
                  {editingPlace && (
                    <div className="existing-images-panel">
                      <span className="panel-subheading">Current Uploaded Photos ({existingPlaceImages.length}):</span>
                      {loadingPlaceImages ? (
                        <p className="loading-subtext">Loading images...</p>
                      ) : existingPlaceImages.length === 0 ? (
                        <p className="no-images-note">No uploaded photos yet. Select files below to add photos.</p>
                      ) : (
                        <div className="existing-images-grid">
                          {existingPlaceImages.map((img) => (
                            <div key={img.image_id} className={`image-manage-card ${img.is_primary ? 'is-primary-card' : ''}`}>
                              <img src={img.full_url} alt="Attraction" className="manage-thumb" />
                              {img.is_primary ? (
                                <span className="primary-pill">★ PRIMARY</span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-set-primary"
                                  onClick={() => handleSetPrimary(img.image_id)}
                                  title="Make this the main photo"
                                >
                                  Make Primary
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-delete-img"
                                onClick={() => handleDeleteImage(img.image_id)}
                                title="Delete photo"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload Dropzone / Button */}
                  <div className="file-upload-box">
                    <input
                      id="placeImageUploadInput"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelection}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="placeImageUploadInput" className="btn-pick-files">
                      <span className="upload-btn-icon">📁</span>
                      <span>{editingPlace ? 'Select Additional Photos to Upload...' : 'Select Photos from Computer...'}</span>
                    </label>
                    <span className="upload-hint">
                      {editingPlace
                        ? 'Files selected here will be uploaded when you click "Save Changes".'
                        : 'Select one or more photos. The first selected photo will automatically become the primary image.'}
                    </span>
                  </div>

                  {/* Selected Previews */}
                  {imagePreviews.length > 0 && (
                    <div className="selected-previews-section">
                      <span className="panel-subheading">Selected Photos Ready to Upload ({imagePreviews.length}):</span>
                      <div className="previews-grid">
                        {imagePreviews.map((prev, idx) => (
                          <div key={idx} className="preview-item">
                            <img src={prev.url} alt={prev.name} className="preview-thumb" />
                            <div className="preview-details">
                              <span className="preview-filename">{prev.name}</span>
                              <span className="preview-filesize">{prev.size}</span>
                              {idx === 0 && (!editingPlace || existingPlaceImages.length === 0) && (
                                <span className="tag-will-be-primary">★ Will be Primary</span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="btn-remove-preview"
                              onClick={() => removeSelectedFile(idx)}
                              title="Remove file"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fallback URL Accordion for Backward Compatibility */}
                  <details className="legacy-url-accordion">
                    <summary className="legacy-accordion-toggle">
                      <span>🔗 External Fallback URL (Optional / Legacy)</span>
                    </summary>
                    <div className="legacy-accordion-content">
                      <input
                        id="pImg"
                        type="url"
                        className="admin-form-input"
                        placeholder="https://images.unsplash.com/... (used if no local photos uploaded)"
                        value={placeForm.image_url}
                        onChange={(e) => setPlaceForm({ ...placeForm, image_url: e.target.value })}
                      />
                    </div>
                  </details>
                </div>
              </div>

              <div className="modal-actions-bar">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowPlaceModal(false)}
                  disabled={isUploadingImages}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit" disabled={isUploadingImages}>
                  {isUploadingImages ? 'Saving & Uploading...' : editingPlace ? 'Save Changes' : 'Create Place'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===============================================
          MODAL: ADD / EDIT CATEGORY
          =============================================== */}
      {showCategoryModal && (
        <div className="admin-modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="admin-modal-card modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar">
              <h3 className="modal-title">{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowCategoryModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="admin-modal-form">
              <div className="form-fields-stack">
                <div className="form-field">
                  <label htmlFor="cName">Category Name *</label>
                  <input
                    id="cName"
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. Wildlife / Recreation"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="cDesc">Description</label>
                  <textarea
                    id="cDesc"
                    rows="3"
                    className="admin-form-textarea"
                    placeholder="Brief description of attraction types in this category..."
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  ></textarea>
                </div>
              </div>

              <div className="modal-actions-bar">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowCategoryModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  {editingCategory ? 'Save Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;
