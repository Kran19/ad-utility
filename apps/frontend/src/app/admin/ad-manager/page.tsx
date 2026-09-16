'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { adminApiFetch } from '../../../lib/admin-api';
import { PhotoGalleryModal, GalleryPhoto } from '../../../components/admin/PhotoGalleryModal';
import { useResizableColumns, ResizableTh } from '../../../components/admin/ResizableTable';

interface MatrixItem {
  id: string;
  slug: string;
  name: string;
  category: { id: string; name: string; slug: string } | null;
  status: 'ACTIVE' | 'DISABLED' | 'DRAFT';
  desktop: number;
  tablet: number;
  mobile: number;
  total: number;
  activeAssignments: number;
}

interface PlacementItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  supportedTypes: string[];
}

interface CampaignItem {
  id: string;
  name: string;
  status: string;
}

interface CreativeItem {
  id: string;
  campaignId?: string;
  name: string;
  type: string;
  mediaUrl?: string;
  targetUrl?: string;
  width?: number;
  height?: number;
  headline?: string;
  body?: string;
  callToAction?: string;
  assetUrl?: string;
  altText?: string;
}

interface TargetingRule {
  id: string;
  campaignId: string;
  placementId: string;
  creativeId?: string;
  deviceTypes: string[];
  utilitySlugs: string[];
  categorySlugs: string[];
  countries: string[];
  priorityOverride?: number;
  weight: number;
  isActive: boolean;
  campaign?: { id: string; name: string; status: string };
  placement?: { id: string; code: string; name: string };
  creative?: {
    id: string;
    name: string;
    type: string;
    mediaUrl?: string;
    targetUrl?: string;
    altText?: string;
    width?: number;
    height?: number;
  };
}

export default function AdminAdManagerPage() {
  const searchParams = useSearchParams();
  const initialUtilityParam = searchParams.get('utility');

  // Resizable Columns for Ad Matrix
  const {
    widths: matrixWidths,
    activeColumn: matrixActiveColumn,
    handleMouseDown: handleMatrixResizeStart,
    resetColumnWidth: resetMatrixColumnWidth,
    resetAllWidths: resetAllMatrixWidths,
    getColStyle: getMatrixColStyle,
  } = useResizableColumns('admin_ad_matrix_table', {
    utility: 220,
    category: 140,
    desktop: 80,
    tablet: 80,
    mobile: 80,
    total: 80,
    actions: 120,
  });

  // Matrix State
  const [matrix, setMatrix] = useState<MatrixItem[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(true);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  // Metadata State
  const [placements, setPlacements] = useState<PlacementItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [creatives, setCreatives] = useState<CreativeItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Filter State
  const [search, setSearch] = useState('');
  const [filterDevice, setFilterDevice] = useState('');
  const [filterPlacement, setFilterPlacement] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');

  // Helper for category metadata icon
  const getCategoryIcon = (slug?: string) => {
    switch (slug) {
      case 'image':
        return '🖼️';
      case 'pdf':
        return '📄';
      case 'text':
        return '✍️';
      case 'developer':
        return '💻';
      case 'ai':
        return '✨';
      case 'video':
        return '🎬';
      case 'audio':
        return '🎵';
      case 'qr-barcode':
        return '📱';
      default:
        return '⚡';
    }
  };

  const BANNER_SIZES = {
    horizontal: {
      small: { label: 'Small', dimensions: '468 × 60 px', width: 468, height: 60, desc: 'Compact Banner' },
      medium: { label: 'Medium', dimensions: '728 × 90 px', width: 728, height: 90, desc: 'Standard Leaderboard' },
      large: { label: 'Large', dimensions: '970 × 250 px', width: 970, height: 250, desc: 'Large Billboard' },
    },
    vertical: {
      small: { label: 'Small', dimensions: '200 × 200 px', width: 200, height: 200, desc: 'Square / QR' },
      medium: { label: 'Medium', dimensions: '300 × 250 px', width: 300, height: 250, desc: 'Medium Card / Box' },
      large: { label: 'Large', dimensions: '300 × 600 px', width: 300, height: 600, desc: 'Tall Skyscraper' },
    },
  };

  // Manage Ads Drawer / Utility View
  const [selectedUtility, setSelectedUtility] = useState<MatrixItem | null>(null);
  const [rules, setRules] = useState<TargetingRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [activeDeviceTab, setActiveDeviceTab] = useState<'ALL' | 'DESKTOP' | 'TABLET' | 'MOBILE'>('ALL');

  // Create Assignment Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    campaignId: '',
    placementId: '',
    adMode: 'custom_image' as 'custom_image' | 'library',
    creativeId: '',
    creativeName: '',
    mediaUrl: '',
    targetUrl: '',
    altText: '',
    sizeOrientation: 'horizontal' as 'horizontal' | 'vertical',
    sizePreset: 'medium' as 'small' | 'medium' | 'large',
    width: 728,
    height: 90,
    deviceTypes: ['DESKTOP', 'MOBILE'] as string[],
    priorityOverride: '',
    weight: 100,
    isActive: true,
  });
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Edit Rule State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState<TargetingRule | null>(null);
  const [editForm, setEditForm] = useState({
    placementId: '',
    adMode: 'custom_image' as 'custom_image' | 'library',
    creativeId: '',
    creativeName: '',
    mediaUrl: '',
    targetUrl: '',
    altText: '',
    sizeOrientation: 'horizontal' as 'horizontal' | 'vertical',
    sizePreset: 'medium' as 'small' | 'medium' | 'large',
    width: 728,
    height: 90,
    deviceTypes: ['DESKTOP', 'MOBILE'] as string[],
    priorityOverride: '',
    weight: 100,
    isActive: true,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Live Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUtilitySlug, setPreviewUtilitySlug] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'DESKTOP' | 'TABLET' | 'MOBILE'>('DESKTOP');
  const [previewPlacement, setPreviewPlacement] = useState('');
  const [previewCountry, setPreviewCountry] = useState('US');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Drag & Drop / File Select State
  const [isDraggingAssign, setIsDraggingAssign] = useState(false);
  const [isDraggingEdit, setIsDraggingEdit] = useState(false);
  const [imageInputMethodAssign, setImageInputMethodAssign] = useState<'upload' | 'url'>('upload');
  const [imageInputMethodEdit, setImageInputMethodEdit] = useState<'upload' | 'url'>('upload');
  const [showGalleryFor, setShowGalleryFor] = useState<'assign' | 'edit' | null>(null);

  const handleSelectPhotoFromGallery = (photo: GalleryPhoto, isEdit: boolean) => {
    const isSquareOrVertical = (photo.height || 1) >= (photo.width || 1) * 0.75;
    const autoOrientation = isSquareOrVertical ? 'vertical' : 'horizontal';
    const autoPreset = isSquareOrVertical ? 'small' : 'medium';
    const defaultDimensions = isSquareOrVertical
      ? BANNER_SIZES.vertical.small
      : BANNER_SIZES.horizontal.medium;

    if (isEdit) {
      setEditForm((prev) => ({
        ...prev,
        mediaUrl: photo.mediaUrl,
        altText: prev.altText || photo.altText || photo.name,
        creativeName: prev.creativeName || photo.name,
        sizeOrientation: autoOrientation,
        sizePreset: autoPreset,
        width: photo.width || defaultDimensions.width,
        height: photo.height || defaultDimensions.height,
      }));
    } else {
      setAssignForm((prev) => ({
        ...prev,
        mediaUrl: photo.mediaUrl,
        altText: prev.altText || photo.altText || photo.name,
        creativeName: prev.creativeName || photo.name,
        sizeOrientation: autoOrientation,
        sizePreset: autoPreset,
        width: photo.width || defaultDimensions.width,
        height: photo.height || defaultDimensions.height,
      }));
    }
  };

  const handleImageFileSelect = (file: File | null | undefined, isEdit: boolean) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WebP, SVG, GIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit. Please upload an optimized banner image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      // Pre-calculate image proportions
      const testImg = new window.Image();
      testImg.onload = () => {
        const isSquareOrVertical = testImg.naturalHeight >= testImg.naturalWidth * 0.75;
        const autoOrientation = isSquareOrVertical ? 'vertical' : 'horizontal';
        const autoPreset = isSquareOrVertical ? 'small' : 'medium';
        const defaultDimensions = isSquareOrVertical
          ? BANNER_SIZES.vertical.small
          : BANNER_SIZES.horizontal.medium;

        if (isEdit) {
          setEditForm((prev) => ({
            ...prev,
            mediaUrl: dataUrl,
            altText: prev.altText || cleanName,
            creativeName: prev.creativeName || cleanName,
            sizeOrientation: autoOrientation,
            sizePreset: autoPreset,
            width: defaultDimensions.width,
            height: defaultDimensions.height,
          }));
        } else {
          setAssignForm((prev) => ({
            ...prev,
            mediaUrl: dataUrl,
            altText: prev.altText || cleanName,
            creativeName: prev.creativeName || cleanName,
            sizeOrientation: autoOrientation,
            sizePreset: autoPreset,
            width: defaultDimensions.width,
            height: defaultDimensions.height,
          }));
        }
      };
      testImg.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Load Metadata (placements, campaigns, creatives, categories)
  useEffect(() => {
    async function loadMetadata() {
      const [pRes, cRes, crRes, catRes] = await Promise.all([
        adminApiFetch('/admin/ads/placements'),
        adminApiFetch('/admin/ads/campaigns?page=1&pageSize=100'),
        adminApiFetch('/admin/ads/creatives?page=1&pageSize=100'),
        adminApiFetch('/admin/utilities/categories'),
      ]);

      if (pRes.success && pRes.data) {
        setPlacements(pRes.data);
        if (pRes.data.length > 0 && !previewPlacement) {
          setPreviewPlacement(pRes.data[0].code);
        }
      }
      if (cRes.success && cRes.data) {
        const rawCampaigns = cRes.data.items || (Array.isArray(cRes.data) ? cRes.data : []);
        // Defensive deduplication by unique database ID (c.id)
        const seenIds = new Set<string>();
        const uniqueCampaigns = rawCampaigns.filter((c: any) => {
          if (!c || !c.id || seenIds.has(c.id)) return false;
          seenIds.add(c.id);
          return true;
        });
        setCampaigns(uniqueCampaigns);
      }
      if (crRes.success && crRes.data) {
        const rawCreatives = crRes.data.items || (Array.isArray(crRes.data) ? crRes.data : []);
        const seenCreativeIds = new Set<string>();
        const uniqueCreatives = rawCreatives.filter((cr: any) => {
          if (!cr || !cr.id || seenCreativeIds.has(cr.id)) return false;
          seenCreativeIds.add(cr.id);
          return true;
        });
        setCreatives(uniqueCreatives);
      }
      if (catRes.success && catRes.data) {
        setCategories(catRes.data || []);
      }
    }
    loadMetadata();
  }, []);

  // Load Ad Matrix
  const loadMatrix = async () => {
    setLoadingMatrix(true);
    setMatrixError(null);

    let query = '/admin/ads/manager/matrix?';
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (filterDevice) params.append('device', filterDevice);
    if (filterPlacement) params.append('placementId', filterPlacement);
    if (filterStatus) params.append('status', filterStatus);
    if (filterCategory) params.append('categoryId', filterCategory);
    if (filterCampaign) params.append('campaignId', filterCampaign);

    const res = await adminApiFetch(query + params.toString());
    if (res.success && res.data) {
      const items: MatrixItem[] = res.data.items || [];
      setMatrix(items);

      // If URL parameter specifies a utility, select it automatically
      if (initialUtilityParam && !selectedUtility) {
        const found = items.find((u) => u.slug.toLowerCase() === initialUtilityParam.toLowerCase());
        if (found) {
          setSelectedUtility(found);
          setPreviewUtilitySlug(found.slug);
        }
      }
    } else {
      setMatrixError(res.error || 'Failed to load ad operations matrix');
    }
    setLoadingMatrix(false);
  };

  useEffect(() => {
    loadMatrix();
  }, [search, filterDevice, filterPlacement, filterStatus, filterCategory, filterCampaign]);

  // Load Targeting Rules for Selected Utility
  const loadUtilityRules = async (utilitySlug: string) => {
    setLoadingRules(true);
    const res = await adminApiFetch(`/admin/ads/targeting?utilitySlug=${encodeURIComponent(utilitySlug)}`);
    if (res.success && res.data) {
      setRules(res.data || []);
    }
    setLoadingRules(false);
  };

  useEffect(() => {
    if (selectedUtility) {
      loadUtilityRules(selectedUtility.slug);
    }
  }, [selectedUtility]);

  // Filtered Rules by active device tab
  const displayedRules = useMemo(() => {
    if (activeDeviceTab === 'ALL') return rules;
    return rules.filter(
      (r) => r.deviceTypes.length === 0 || r.deviceTypes.includes(activeDeviceTab),
    );
  }, [rules, activeDeviceTab]);

  // Handle Toggle Rule Status (ACTIVE <-> DISABLED)
  const handleToggleRuleStatus = async (rule: TargetingRule) => {
    const nextIsActive = !rule.isActive;
    const res = await adminApiFetch(`/admin/ads/targeting/${rule.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: nextIsActive }),
    });

    if (res.success) {
      if (selectedUtility) loadUtilityRules(selectedUtility.slug);
      loadMatrix();
    } else {
      alert(res.error || 'Failed to update targeting rule status');
    }
  };

  // Handle Delete Rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to remove this ad assignment?')) return;
    const res = await adminApiFetch(`/admin/ads/targeting/${ruleId}`, {
      method: 'DELETE',
    });

    if (res.success) {
      if (selectedUtility) loadUtilityRules(selectedUtility.slug);
      loadMatrix();
    } else {
      alert(res.error || 'Failed to delete targeting rule');
    }
  };

  // Handle Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUtility) return;
    if (!assignForm.campaignId || !assignForm.placementId) {
      alert('Please select a campaign and an inventory placement slot.');
      return;
    }

    setAssignSubmitting(true);
    let finalCreativeId = assignForm.creativeId;

    if (assignForm.adMode === 'custom_image') {
      if (!assignForm.mediaUrl || !assignForm.targetUrl) {
        alert('Please provide both the Ad Image URL and the Redirect Page URL.');
        setAssignSubmitting(false);
        return;
      }

      const placementObj = placements.find((p) => p.id === assignForm.placementId);
      const creativeRes = await adminApiFetch('/admin/ads/creatives', {
        method: 'POST',
        body: JSON.stringify({
          name: assignForm.creativeName || `${selectedUtility.name} ${placementObj?.code || 'Banner'} Ad`,
          type: 'IMAGE',
          mediaUrl: assignForm.mediaUrl,
          targetUrl: assignForm.targetUrl,
          altText: assignForm.altText || assignForm.creativeName || `${selectedUtility.name} Advertisement`,
          width: Number(assignForm.width) || 728,
          height: Number(assignForm.height) || 90,
        }),
      });

      if (!creativeRes.success || !creativeRes.data?.id) {
        alert(creativeRes.error || 'Failed to create image creative asset');
        setAssignSubmitting(false);
        return;
      }
      finalCreativeId = creativeRes.data.id;
    } else {
      if (!assignForm.creativeId) {
        alert('Please select a creative asset from the library.');
        setAssignSubmitting(false);
        return;
      }
    }

    const payload: any = {
      campaignId: assignForm.campaignId,
      placementId: assignForm.placementId,
      creativeId: finalCreativeId,
      deviceTypes: assignForm.deviceTypes,
      utilitySlugs: [selectedUtility.slug],
      weight: Number(assignForm.weight) || 100,
      isActive: assignForm.isActive,
    };
    if (assignForm.priorityOverride !== '') {
      payload.priorityOverride = Number(assignForm.priorityOverride);
    }

    const res = await adminApiFetch('/admin/ads/targeting', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setAssignSubmitting(false);
    if (res.success) {
      setShowAssignModal(false);
      setAssignForm({
        campaignId: '',
        placementId: '',
        adMode: 'custom_image',
        creativeId: '',
        creativeName: '',
        mediaUrl: '',
        targetUrl: '',
        altText: '',
        sizeOrientation: 'horizontal',
        sizePreset: 'medium',
        width: 728,
        height: 90,
        deviceTypes: ['DESKTOP', 'MOBILE'],
        priorityOverride: '',
        weight: 100,
        isActive: true,
      });
      loadUtilityRules(selectedUtility.slug);
      loadMatrix();
    } else {
      alert(res.error || 'Failed to create ad assignment');
    }
  };

  // Handle Open Edit Modal
  const handleOpenEditModal = (rule: TargetingRule) => {
    setEditingRule(rule);
    const existingCreative = rule.creative || creatives.find((c) => c.id === rule.creativeId);
    const isVertical = Boolean(existingCreative?.height && existingCreative?.width && existingCreative.height >= existingCreative.width * 0.75);
    const crWidth = existingCreative?.width || (isVertical ? 200 : 728);
    const crHeight = existingCreative?.height || (isVertical ? 200 : 90);

    setEditForm({
      placementId: rule.placementId || rule.placement?.id || '',
      adMode: existingCreative?.type === 'IMAGE' || !rule.creativeId ? 'custom_image' : 'library',
      creativeId: rule.creativeId || rule.creative?.id || '',
      creativeName: existingCreative?.name || `${selectedUtility?.name} Ad`,
      mediaUrl: existingCreative?.mediaUrl || '',
      targetUrl: existingCreative?.targetUrl || '',
      altText: existingCreative?.altText || existingCreative?.name || '',
      sizeOrientation: isVertical ? 'vertical' : 'horizontal',
      sizePreset: (crWidth === 468 || crWidth === 200) ? 'small' : (crWidth === 970 || crHeight === 600) ? 'large' : 'medium',
      width: crWidth,
      height: crHeight,
      deviceTypes: rule.deviceTypes && rule.deviceTypes.length > 0 ? [...rule.deviceTypes] : ['DESKTOP', 'TABLET', 'MOBILE'],
      priorityOverride: rule.priorityOverride !== null && rule.priorityOverride !== undefined ? String(rule.priorityOverride) : '',
      weight: rule.weight || 100,
      isActive: rule.isActive ?? true,
    });
    setShowEditModal(true);
  };

  // Handle Save Edited Rule
  const handleSaveEditedRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !selectedUtility) return;
    if (!editForm.placementId) {
      alert('Please select an inventory placement slot.');
      return;
    }
    if (editForm.deviceTypes.length === 0) {
      alert('Please select at least one target device type.');
      return;
    }

    setEditSubmitting(true);
    let finalCreativeId = editForm.creativeId;

    if (editForm.adMode === 'custom_image') {
      if (!editForm.mediaUrl || !editForm.targetUrl) {
        alert('Please provide both the Ad Image URL and the Redirect Page URL.');
        setEditSubmitting(false);
        return;
      }

      // If existing rule had an attached creative and it was an IMAGE creative, update it
      const currentCreativeId = editingRule.creativeId || editingRule.creative?.id;
      if (currentCreativeId && editingRule.creative?.type === 'IMAGE') {
        const updateCrRes = await adminApiFetch(`/admin/ads/creatives/${currentCreativeId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: editForm.creativeName || editingRule.creative?.name || `${selectedUtility.name} Banner Ad`,
            type: 'IMAGE',
            mediaUrl: editForm.mediaUrl,
            targetUrl: editForm.targetUrl,
            altText: editForm.altText || editForm.creativeName || `${selectedUtility.name} Advertisement`,
            width: Number(editForm.width) || 728,
            height: Number(editForm.height) || 90,
          }),
        });
        if (!updateCrRes.success) {
          alert(updateCrRes.error || 'Failed to update creative asset');
          setEditSubmitting(false);
          return;
        }
        finalCreativeId = currentCreativeId;
      } else {
        // Create new Image Creative
        const placementObj = placements.find((p) => p.id === editForm.placementId);
        const createCrRes = await adminApiFetch('/admin/ads/creatives', {
          method: 'POST',
          body: JSON.stringify({
            name: editForm.creativeName || `${selectedUtility.name} ${placementObj?.code || 'Banner'} Ad`,
            type: 'IMAGE',
            mediaUrl: editForm.mediaUrl,
            targetUrl: editForm.targetUrl,
            altText: editForm.altText || editForm.creativeName || `${selectedUtility.name} Advertisement`,
            width: Number(editForm.width) || 728,
            height: Number(editForm.height) || 90,
          }),
        });
        if (!createCrRes.success || !createCrRes.data?.id) {
          alert(createCrRes.error || 'Failed to create image creative asset');
          setEditSubmitting(false);
          return;
        }
        finalCreativeId = createCrRes.data.id;
      }
    } else {
      if (!editForm.creativeId) {
        alert('Please select a creative asset from the library.');
        setEditSubmitting(false);
        return;
      }
    }

    const payload: any = {
      placementId: editForm.placementId,
      creativeId: finalCreativeId,
      deviceTypes: editForm.deviceTypes,
      weight: Number(editForm.weight) || 100,
      isActive: editForm.isActive,
      priorityOverride: editForm.priorityOverride !== '' ? Number(editForm.priorityOverride) : null,
    };

    const res = await adminApiFetch(`/admin/ads/targeting/${editingRule.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    setEditSubmitting(false);
    if (res.success) {
      setShowEditModal(false);
      setEditingRule(null);
      loadUtilityRules(selectedUtility.slug);
      loadMatrix();
    } else {
      alert(res.error || 'Failed to update ad rule');
    }
  };

  // Handle Live Ad Preview
  const handleRunPreview = async () => {
    if (!previewUtilitySlug || !previewPlacement) {
      alert('Please select a utility and placement code.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewResult(null);

    const res = await adminApiFetch('/admin/ads/preview', {
      method: 'POST',
      body: JSON.stringify({
        utilitySlug: previewUtilitySlug,
        device: previewDevice,
        placement: previewPlacement,
        country: previewCountry || undefined,
      }),
    });

    setPreviewLoading(false);
    if (res.success && res.data) {
      setPreviewResult(res.data);
    } else {
      setPreviewError(res.error || 'Failed to execute ad preview');
    }
  };

  // Quick launch preview for a row
  const openPreviewForRow = (u: MatrixItem, device: 'DESKTOP' | 'TABLET' | 'MOBILE' = 'DESKTOP') => {
    setPreviewUtilitySlug(u.slug);
    setPreviewDevice(device);
    if (placements.length > 0 && !previewPlacement) {
      setPreviewPlacement(placements[0].code);
    }
    setShowPreviewModal(true);
    // automatically run preview
    setTimeout(() => {
      handleRunPreview();
    }, 100);
  };

  const [showInventoryGuide, setShowInventoryGuide] = useState(false);

  const CANONICAL_PLACEMENTS_REFERENCE = [
    { code: 'HEADER_BANNER', desktop: true, tablet: true, mobile: true, location: 'Below navbar, above breadcrumbs' },
    { code: 'TOP_CONTENT', desktop: true, tablet: true, mobile: true, location: 'Below description, above Tool workspace' },
    { code: 'AFTER_TOOL', desktop: true, tablet: true, mobile: true, location: 'Immediately below primary Tool workspace' },
    { code: 'MID_CONTENT', desktop: true, tablet: true, mobile: true, location: 'Embedded between How-to Guide and FAQ' },
    { code: 'BOTTOM_CONTENT', desktop: true, tablet: true, mobile: true, location: 'Below Related Utilities, above Footer' },
    { code: 'SIDEBAR', desktop: true, tablet: false, mobile: false, location: 'Desktop right-column advertisement' },
    { code: 'MOBILE_STICKY', desktop: false, tablet: true, mobile: true, location: 'Mobile bottom fixed sticky overlay' },
    { code: 'DESKTOP_STICKY', desktop: true, tablet: false, mobile: false, location: 'Desktop bottom-right corner sticky ad' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ad Operations & Targeting Matrix</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure device-specific ad assignments, manage creative priority, and preview live ad selector behavior
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowInventoryGuide(!showInventoryGuide)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5"
          >
            <span>📐</span> {showInventoryGuide ? 'Hide Inventory Matrix' : 'Placement Matrix'}
          </button>
          <button
            onClick={() => {
              if (!previewUtilitySlug && matrix.length > 0) {
                setPreviewUtilitySlug(matrix[0].slug);
              }
              setShowPreviewModal(true);
            }}
            className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5"
          >
            <span>👁️</span> Live Ad Preview
          </button>
          <Link
            href="/admin/utilities"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5"
          >
            <span>⚡</span> Utilities Registry
          </Link>
        </div>
      </div>

      {/* Canonical Placement Inventory Device Matrix Guide */}
      {showInventoryGuide && (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📐</span> Canonical Ad Placement Inventory (Phase 30)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Supported Device Compatibility</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="px-3 py-2">Placement Code</th>
                  <th className="px-3 py-2 text-center">Desktop</th>
                  <th className="px-3 py-2 text-center">Tablet</th>
                  <th className="px-3 py-2 text-center">Mobile</th>
                  <th className="px-3 py-2">Physical Location & Semantics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                {CANONICAL_PLACEMENTS_REFERENCE.map((p) => (
                  <tr key={p.code} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-bold text-indigo-400">{p.code}</td>
                    <td className="px-3 py-2 text-center">{p.desktop ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-2 text-center">{p.tablet ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-2 text-center">{p.mobile ? <span className="text-emerald-400 font-bold">✓</span> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-2 font-sans text-slate-300">{p.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Total Utilities</span>
          <p className="text-xl font-bold text-white mt-1">{matrix.length}</p>
          <span className="text-[10px] text-slate-500">Registered tools</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Desktop Placements</span>
          <p className="text-xl font-bold text-indigo-400 mt-1">
            {matrix.reduce((acc, curr) => acc + curr.desktop, 0)}
          </p>
          <span className="text-[10px] text-slate-500">Applicable rules</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Mobile Placements</span>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {matrix.reduce((acc, curr) => acc + curr.mobile, 0)}
          </p>
          <span className="text-[10px] text-slate-500">Applicable rules</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Inventory Slots</span>
          <p className="text-xl font-bold text-amber-400 mt-1">{placements.length}</p>
          <span className="text-[10px] text-slate-500">Active placement codes</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search utility name or /slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Device Filter */}
          <div>
            <select
              value={filterDevice}
              onChange={(e) => setFilterDevice(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Devices</option>
              <option value="DESKTOP">DESKTOP</option>
              <option value="TABLET">TABLET</option>
              <option value="MOBILE">MOBILE</option>
            </select>
          </div>

          {/* Placement Filter (Dynamically loaded) */}
          <div>
            <select
              value={filterPlacement}
              onChange={(e) => setFilterPlacement(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Placements</option>
              {placements.map((p) => (
                <option key={p.id} value={p.id}>{p.code}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {(search || filterDevice || filterPlacement || filterStatus || filterCategory || filterCampaign) && (
          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/60 text-slate-400">
            <span>Active filters applied</span>
            <button
              onClick={() => {
                setSearch('');
                setFilterDevice('');
                setFilterPlacement('');
                setFilterStatus('');
                setFilterCategory('');
                setFilterCampaign('');
              }}
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Category Wise Quick Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              📁 Category Wise Utilities
            </span>
            <span className="text-[11px] text-slate-500">
              (Click any category to filter ad allocations)
            </span>
          </div>
          {filterCategory && (
            <button
              onClick={() => setFilterCategory('')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold hover:underline flex items-center gap-1"
            >
              <span>View All Categories</span> &rarr;
            </button>
          )}
        </div>

        {/* Category Cards / Pills Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {/* All Button */}
          <button
            type="button"
            onClick={() => setFilterCategory('')}
            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              !filterCategory
                ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm ring-2 ring-indigo-500/30'
                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="text-base mb-1">🌐</div>
            <div>
              <div className="text-xs font-bold truncate">All Categories</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {matrix.length} tools
              </div>
            </div>
          </button>

          {categories.map((c) => {
            const isSelected = filterCategory === c.id;
            const icon = getCategoryIcon(c.slug);
            const count = (c.utilities && c.utilities.length) || c.utilityCount || (c._count?.utilities) || 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setFilterCategory('');
                  } else {
                    setFilterCategory(c.id);
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm ring-2 ring-indigo-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-base mb-1">{icon}</div>
                <div>
                  <div className="text-xs font-bold truncate">{c.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {count > 0 ? `${count} tools` : 'Explore'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Layout: Matrix Table & Selected Utility Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Matrix Table (7 cols on large, 12 if no utility selected) */}
        <div className={`${selectedUtility ? 'lg:col-span-7' : 'lg:col-span-12'} bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all`}>
          <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-slate-300">Utility Ad Allocation Matrix</span>
              {filterCategory && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {categories.find((c) => c.id === filterCategory)?.name || 'Filtered'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetAllMatrixWidths}
                title="Reset column widths to default"
                className="text-[10px] px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg transition-colors flex items-center gap-1 font-medium"
              >
                <span>↔️</span> Reset
              </button>
              <span className="text-[11px] text-slate-500 font-mono">{matrix.length} utilities</span>
            </div>
          </div>

          {loadingMatrix ? (
            <div className="py-24 text-center text-xs text-slate-400">Loading ad matrix...</div>
          ) : matrixError ? (
            <div className="py-16 text-center text-xs text-rose-400 px-4">
              <p className="font-semibold">{matrixError}</p>
              <button
                onClick={loadMatrix}
                className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
              >
                Retry
              </button>
            </div>
          ) : matrix.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-400">No utilities match the selected criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 table-fixed">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                  <tr>
                    <ResizableTh
                      colKey="utility"
                      width={matrixWidths.utility}
                      onResizeStart={handleMatrixResizeStart}
                      onDoubleClickResize={resetMatrixColumnWidth}
                      isActive={matrixActiveColumn === 'utility'}
                      className="px-4 py-3"
                    >
                      Utility
                    </ResizableTh>
                    <ResizableTh
                      colKey="category"
                      width={matrixWidths.category}
                      onResizeStart={handleMatrixResizeStart}
                      onDoubleClickResize={resetMatrixColumnWidth}
                      isActive={matrixActiveColumn === 'category'}
                      className="px-3 py-3"
                    >
                      Category
                    </ResizableTh>
                    <ResizableTh
                      colKey="desktop"
                      width={matrixWidths.desktop}
                      onResizeStart={handleMatrixResizeStart}
                      onDoubleClickResize={resetMatrixColumnWidth}
                      isActive={matrixActiveColumn === 'desktop'}
                      className="px-3 py-3 text-center"
                    >
                      Desktop
                    </ResizableTh>
                    <ResizableTh
                      colKey="tablet"
                      width={matrixWidths.tablet}
                      onResizeStart={handleMatrixResizeStart}
                      onDoubleClickResize={resetMatrixColumnWidth}
                      isActive={matrixActiveColumn === 'tablet'}
                      className="px-3 py-3 text-center"
                    >
                      Tablet
                    </ResizableTh>
                    <ResizableTh
                      colKey="mobile"
                      width={matrixWidths.mobile}
                      onResizeStart={handleMatrixResizeStart}
                      onDoubleClickResize={resetMatrixColumnWidth}
                      isActive={matrixActiveColumn === 'mobile'}
                      className="px-3 py-3 text-center"
                    >
                      Mobile
                    </ResizableTh>
                    <ResizableTh
                      colKey="total"
                      width={matrixWidths.total}
                      onResizeStart={handleMatrixResizeStart}
                      onDoubleClickResize={resetMatrixColumnWidth}
                      isActive={matrixActiveColumn === 'total'}
                      className="px-3 py-3 text-center"
                    >
                      Total
                    </ResizableTh>
                    <ResizableTh
                      colKey="actions"
                      width={matrixWidths.actions}
                      onResizeStart={handleMatrixResizeStart}
                      onDoubleClickResize={resetMatrixColumnWidth}
                      isActive={matrixActiveColumn === 'actions'}
                      className="px-3 py-3 text-right"
                    >
                      Actions
                    </ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {matrix.map((u) => {
                    const isSelected = selectedUtility?.id === u.id;
                    return (
                      <tr
                        key={u.id}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-950/30 border-l-2 border-l-indigo-500' : 'hover:bg-slate-800/30'
                        }`}
                        onClick={() => {
                          setSelectedUtility(u);
                          setPreviewUtilitySlug(u.slug);
                        }}
                      >
                        <td style={getMatrixColStyle('utility')} className="px-4 py-3 overflow-hidden">
                          <div className="font-semibold text-white flex items-center gap-1.5 truncate" title={u.name}>
                            <span>{getCategoryIcon(u.category?.slug)}</span>
                            <span className="truncate">{u.name}</span>
                          </div>
                          <div className="text-[11px] text-indigo-400 font-mono truncate">/{u.slug}</div>
                        </td>
                        <td style={getMatrixColStyle('category')} className="px-3 py-3 overflow-hidden">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-[11px] text-slate-300 border border-slate-700/60 truncate max-w-full" title={u.category?.name || '—'}>
                            {u.category?.name || '—'}
                          </span>
                        </td>
                        <td style={getMatrixColStyle('desktop')} className="px-3 py-3 text-center overflow-hidden">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              u.desktop > 0 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-600'
                            }`}
                          >
                            {u.desktop}
                          </span>
                        </td>
                        <td style={getMatrixColStyle('tablet')} className="px-3 py-3 text-center overflow-hidden">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              u.tablet > 0 ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-600'
                            }`}
                          >
                            {u.tablet}
                          </span>
                        </td>
                        <td style={getMatrixColStyle('mobile')} className="px-3 py-3 text-center overflow-hidden">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              u.mobile > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-600'
                            }`}
                          >
                            {u.mobile}
                          </span>
                        </td>
                        <td style={getMatrixColStyle('total')} className="px-3 py-3 text-center overflow-hidden">
                          <span className="font-mono text-slate-300 font-semibold">{u.total}</span>
                        </td>
                        <td style={getMatrixColStyle('actions')} className="px-3 py-3 text-right space-x-1.5 whitespace-nowrap overflow-hidden" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedUtility(u);
                              setPreviewUtilitySlug(u.slug);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors"
                          >
                            Manage
                          </button>
                          <button
                            onClick={() => openPreviewForRow(u, 'DESKTOP')}
                            className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded text-[11px] transition-colors"
                            title="Preview ad on Desktop"
                          >
                            👁️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Utility Details & Device Assignments (5 cols on large) */}
        {selectedUtility && (
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col space-y-4 p-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">{selectedUtility.name}</h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${selectedUtility.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {selectedUtility.status}
                  </span>
                </div>
                <p className="text-xs text-indigo-400 font-mono mt-0.5">/{selectedUtility.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openPreviewForRow(selectedUtility)}
                  className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded text-xs border border-indigo-500/30 transition-colors"
                >
                  👁️ Preview
                </button>
                <button
                  onClick={() => setSelectedUtility(null)}
                  className="text-slate-400 hover:text-white text-sm px-1.5"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Device Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {(['ALL', 'DESKTOP', 'TABLET', 'MOBILE'] as const).map((tab) => {
                const count =
                  tab === 'ALL'
                    ? rules.length
                    : tab === 'DESKTOP'
                    ? selectedUtility.desktop
                    : tab === 'TABLET'
                    ? selectedUtility.tablet
                    : selectedUtility.mobile;
                const isActive = activeDeviceTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveDeviceTab(tab)}
                    className={`flex-1 py-1.5 px-2 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{tab}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-800 text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Phase 31: Core 4-Ad Monetization Inventory Coverage Card */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/90 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">Core 4-Ad Monetization Inventory</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Phase 31
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  {['HEADER_BANNER', 'TOP_CONTENT', 'AFTER_TOOL', 'BOTTOM_CONTENT'].filter(code => rules.some(r => r.placement?.code === code && r.isActive)).length}/4 Core Covered
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
                {[
                  { code: 'HEADER_BANNER', label: '1. Header' },
                  { code: 'TOP_CONTENT', label: '2. Top Content' },
                  { code: 'AFTER_TOOL', label: '3. After Tool' },
                  { code: 'BOTTOM_CONTENT', label: '4. Bottom' },
                ].map(({ code, label }) => {
                  const isCovered = rules.some(r => r.placement?.code === code && r.isActive);
                  return (
                    <div
                      key={code}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        isCovered
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 shadow-xs'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="font-semibold text-slate-300">{label}</div>
                      <div className="text-[9px] mt-0.5 font-bold">
                        {isCovered ? <span className="text-emerald-400">✓ Active</span> : <span className="text-slate-500">Unassigned</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Header + Add Assignment Button */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-slate-300">
                Assigned Ad Rules ({displayedRules.length})
              </span>
              <button
                onClick={() => {
                  setAssignForm((prev) => ({
                    ...prev,
                    campaignId: campaigns[0]?.id || '',
                    placementId: placements[0]?.id || '',
                    creativeId: creatives[0]?.id || '',
                  }));
                  setShowAssignModal(true);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>+</span> Assign Ad
              </button>
            </div>

            {/* Rules List */}
            {loadingRules ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading assignments...</div>
            ) : displayedRules.length === 0 ? (
              <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-2">
                <p className="text-xs text-slate-400">No ad rules assigned to this utility for {activeDeviceTab}.</p>
                <p className="text-[11px] text-slate-500">
                  When no direct rule is configured, the Ad Selector automatically evaluates category rules or global placement fallbacks.
                </p>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  + Assign First Ad Rule
                </button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
                {displayedRules.map((r) => (
                  <div
                    key={r.id}
                    className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 transition-colors hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-xs">
                            {r.campaign?.name || 'Unnamed Campaign'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                              r.campaign?.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {r.campaign?.status || 'UNKNOWN'}
                          </span>
                        </div>
                        <div className="text-[11px] text-indigo-400 font-mono mt-0.5">
                          Placement: {r.placement?.code || r.placementId}
                        </div>
                      </div>

                      {/* Status Toggle (ACTIVE / DISABLED) */}
                      <button
                        onClick={() => handleToggleRuleStatus(r)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono transition-colors ${
                          r.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                        title="Click to toggle status"
                      >
                        {r.isActive ? 'ACTIVE' : 'DISABLED'}
                      </button>
                    </div>

                    {/* Creative Details */}
                    {r.creative && (
                      <div className="bg-slate-900/60 rounded-lg p-2.5 text-[11px] text-slate-300 space-y-2">
                        <div className="flex items-center justify-between">
                          <span>Creative: <strong className="text-white">{r.creative.name}</strong></span>
                          <span className="font-mono text-slate-400 text-[10px] px-1.5 py-0.5 rounded bg-slate-800">{r.creative.type}</span>
                        </div>
                        {r.creative.type === 'IMAGE' && r.creative.mediaUrl && (
                          <div className="flex items-center gap-3 pt-1 border-t border-slate-800/40">
                            <img
                              src={r.creative.mediaUrl}
                              alt={r.creative.altText || r.creative.name}
                              className="h-10 w-24 object-cover rounded bg-slate-950 border border-slate-800 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] text-slate-400 truncate">
                                Target: <a href={r.creative.targetUrl || '#'} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">{r.creative.targetUrl || 'No redirect URL'}</a>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Targeting Specs */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500">Devices:</span>
                        {r.deviceTypes.length === 0 ? (
                          <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300">ALL</span>
                        ) : (
                          r.deviceTypes.map((d) => (
                            <span key={d} className="px-1.5 py-0.5 bg-indigo-950/60 border border-indigo-800/50 rounded text-[10px] text-indigo-300 font-mono">
                              {d}
                            </span>
                          ))
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span>Weight: <strong className="text-slate-200">{r.weight}</strong></span>
                        {r.priorityOverride !== null && r.priorityOverride !== undefined && (
                          <span>Prio: <strong className="text-amber-300">{r.priorityOverride}</strong></span>
                        )}
                        <button
                          onClick={() => handleOpenEditModal(r)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-[11px] font-medium transition-colors flex items-center gap-1 border border-slate-700/60"
                          title="Edit ad rule"
                        >
                          <span>✏️</span> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRule(r.id)}
                          className="text-rose-400 hover:text-rose-300 text-xs ml-1"
                          title="Delete assignment"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign Ad Modal */}
      {showAssignModal && selectedUtility && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>➕</span> Assign Ad to Utility
                </h2>
                <p className="text-xs text-slate-400">Targeting for <strong className="text-indigo-400">{selectedUtility.name}</strong></p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="assign-ad-form" onSubmit={handleCreateAssignment} className="p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
              {/* Campaign */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Select Campaign</label>
                <select
                  required
                  value={assignForm.campaignId}
                  onChange={(e) => setAssignForm({ ...assignForm, campaignId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">{campaigns.length === 0 ? '-- No Campaigns Available --' : '-- Choose Campaign --'}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                  ))}
                </select>
              </div>

              {/* Placement */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Inventory Placement Slot</label>
                <select
                  required
                  value={assignForm.placementId}
                  onChange={(e) => setAssignForm({ ...assignForm, placementId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">{placements.length === 0 ? '-- No Placements Available --' : '-- Choose Placement Slot --'}</option>
                  {placements.map((p) => {
                    let label = `${p.code} — ${p.name}`;
                    if (selectedUtility?.slug === 'home') {
                      if (p.code === 'MID_CONTENT') label = `MID_CONTENT — In-feed Banner (After PDF Tools)`;
                      if (p.code === 'AFTER_TOOL') label = `AFTER_TOOL — In-feed Banner (After Video Tools)`;
                      if (p.code === 'HEADER_BANNER') label = `HEADER_BANNER — Header Banner (Top of Page)`;
                      if (p.code === 'TOP_CONTENT') label = `TOP_CONTENT — Top Content Banner (Below Hero)`;
                      if (p.code === 'BOTTOM_CONTENT') label = `BOTTOM_CONTENT — Bottom Content Banner (Bottom of Page)`;
                    }
                    return (
                      <option key={p.id} value={p.id}>{label}</option>
                    );
                  })}
                </select>
              </div>

              {/* Ad Content Source Tabs */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <label className="text-xs font-semibold text-slate-300">Ad Creative Configuration</label>
                <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, adMode: 'custom_image' })}
                    className={`flex-1 py-1.5 px-3 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      assignForm.adMode === 'custom_image'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>🖼️ Custom Image Ad</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, adMode: 'library' })}
                    className={`flex-1 py-1.5 px-3 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      assignForm.adMode === 'library'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>📚 Choose from Library</span>
                  </button>
                </div>
              </div>

              {/* Custom Image Ad Fields */}
              {assignForm.adMode === 'custom_image' ? (
                <div className="space-y-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                  {/* 1. Image Dropzone / File Selector / URL Input */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <span>🖼️</span> Ad Banner Image
                      </label>
                      <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setImageInputMethodAssign('upload')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            imageInputMethodAssign === 'upload'
                              ? 'bg-indigo-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          📁 Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageInputMethodAssign('url')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            imageInputMethodAssign === 'url'
                              ? 'bg-indigo-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          🔗 URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowGalleryFor('assign')}
                          className="px-2.5 py-1 rounded-md bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors font-semibold border border-indigo-500/30 flex items-center gap-1"
                        >
                          <span>📸</span> Photo Gallery
                        </button>
                      </div>
                    </div>

                    {imageInputMethodAssign === 'upload' ? (
                      /* Drag and Drop Zone */
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingAssign(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsDraggingAssign(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingAssign(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleImageFileSelect(e.dataTransfer.files[0], false);
                          }
                        }}
                        onClick={() => {
                          const input = document.getElementById('assign-file-input');
                          if (input) input.click();
                        }}
                        className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                          isDraggingAssign
                            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                            : assignForm.mediaUrl
                            ? 'border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-500/60'
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40'
                        }`}
                      >
                        <input
                          type="file"
                          id="assign-file-input"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageFileSelect(e.target.files[0], false);
                            }
                          }}
                          className="hidden"
                        />

                        <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-sm text-indigo-400">
                          {assignForm.mediaUrl ? '✓' : '☁️'}
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-white">
                            {assignForm.mediaUrl ? 'Click or drag new image to replace' : 'Click to select image or drag & drop here'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            PNG, JPG, WebP, SVG, GIF (Up to 10MB)
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Direct URL Input */
                      <div>
                        <input
                          type="url"
                          placeholder="https://example.com/images/ad-banner.png"
                          value={assignForm.mediaUrl}
                          onChange={(e) => setAssignForm({ ...assignForm, mediaUrl: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    )}
                  </div>

                  {/* Live Banner Preview Box */}
                  {assignForm.mediaUrl && (
                    <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-3 overflow-hidden flex flex-col items-center justify-center min-h-[90px] space-y-2">
                      <div className="w-full flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-slate-800/60 font-mono">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <span>●</span> Live Preview ({assignForm.width} × {assignForm.height}px)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssignForm({ ...assignForm, mediaUrl: '' });
                          }}
                          className="text-rose-400 hover:text-rose-300 font-medium"
                        >
                          ✕ Remove Image
                        </button>
                      </div>
                      <div className="flex items-center justify-center p-2 w-full bg-slate-900/50 rounded-lg border border-slate-800/60">
                        <img
                          src={assignForm.mediaUrl}
                          alt="Ad preview"
                          style={{
                            maxHeight: assignForm.sizeOrientation === 'vertical'
                              ? assignForm.sizePreset === 'small' ? '120px' : '160px'
                              : assignForm.sizePreset === 'small' ? '45px' : assignForm.sizePreset === 'large' ? '110px' : '65px',
                            maxWidth: '100%',
                          }}
                          className="w-auto h-auto object-contain rounded-md shadow-xs"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 2. Banner Orientation & Size Selector */}
                  <div className="space-y-2.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <span>📐</span> Banner Size & Orientation
                      </label>
                      {/* Orientation Switcher */}
                      <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            const dims = BANNER_SIZES.horizontal[assignForm.sizePreset];
                            setAssignForm((prev) => ({
                              ...prev,
                              sizeOrientation: 'horizontal',
                              width: dims.width,
                              height: dims.height,
                            }));
                          }}
                          className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                            assignForm.sizeOrientation === 'horizontal'
                              ? 'bg-indigo-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>↔</span> Horizontal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const dims = BANNER_SIZES.vertical[assignForm.sizePreset];
                            setAssignForm((prev) => ({
                              ...prev,
                              sizeOrientation: 'vertical',
                              width: dims.width,
                              height: dims.height,
                            }));
                          }}
                          className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                            assignForm.sizeOrientation === 'vertical'
                              ? 'bg-indigo-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>↕</span> Vertical / Square
                        </button>
                      </div>
                    </div>

                    {/* Size Options (Small, Medium, Large) */}
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as const).map((key) => {
                        const opt = BANNER_SIZES[assignForm.sizeOrientation][key];
                        const isSelected = assignForm.sizePreset === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setAssignForm((prev) => ({
                                ...prev,
                                sizePreset: key,
                                width: opt.width,
                                height: opt.height,
                              }));
                            }}
                            className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-sm ring-1 ring-indigo-500/50'
                                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-semibold text-white">{opt.label}</span>
                              {isSelected && <span className="text-[10px] text-indigo-400 font-bold">✓</span>}
                            </div>
                            <div className="text-[10px] font-mono text-indigo-300 font-medium mt-0.5">{opt.dimensions}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 truncate">{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Redirect Page URL */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span>🔗</span> Redirect Page URL (When user clicks on ad)
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://example.com/landing-page"
                      value={assignForm.targetUrl}
                      onChange={(e) => setAssignForm({ ...assignForm, targetUrl: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Visitors who click on this ad banner will be redirected to this landing page.
                    </p>
                  </div>

                  {/* 4. Ad Title / Alt Text */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Ad Title / Alt Text (Optional)</label>
                    <input
                      type="text"
                      placeholder={`e.g. ${selectedUtility.name} Sponsor Banner`}
                      value={assignForm.altText}
                      onChange={(e) => setAssignForm({ ...assignForm, altText: e.target.value, creativeName: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                /* Choose from Library */
                <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Select Creative Asset</label>
                    <select
                      required
                      value={assignForm.creativeId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const found = creatives.find((c) => c.id === selectedId);
                        setAssignForm({
                          ...assignForm,
                          creativeId: selectedId,
                          mediaUrl: found?.mediaUrl || '',
                          targetUrl: found?.targetUrl || '',
                          creativeName: found?.name || '',
                          altText: found?.altText || found?.name || '',
                        });
                      }}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">{creatives.length === 0 ? '-- No Creatives Available --' : '-- Choose Creative Asset --'}</option>
                      {creatives.map((cr) => (
                        <option key={cr.id} value={cr.id}>{cr.name} ({cr.type})</option>
                      ))}
                    </select>
                  </div>

                  {assignForm.mediaUrl && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      <div className="text-[11px] text-slate-400">
                        Image: <span className="font-mono text-indigo-400 truncate block">{assignForm.mediaUrl}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Redirect: <span className="font-mono text-emerald-400 truncate block">{assignForm.targetUrl || 'No target URL configured'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Device Targeting */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Device Targeting</label>
                <div className="flex items-center gap-4 mt-1.5">
                  {(['DESKTOP', 'TABLET', 'MOBILE'] as const).map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignForm.deviceTypes.includes(d)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignForm({ ...assignForm, deviceTypes: [...assignForm.deviceTypes, d] });
                          } else {
                            setAssignForm({
                              ...assignForm,
                              deviceTypes: assignForm.deviceTypes.filter((x) => x !== d),
                            });
                          }
                        }}
                        className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{d}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority & Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Priority Override</label>
                  <input
                    type="number"
                    placeholder="Optional (e.g. 10)"
                    value={assignForm.priorityOverride}
                    onChange={(e) => setAssignForm({ ...assignForm, priorityOverride: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Weight (1–1000)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={assignForm.weight}
                    onChange={(e) => setAssignForm({ ...assignForm, weight: Number(e.target.value) || 100 })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="assignActive"
                  checked={assignForm.isActive}
                  onChange={(e) => setAssignForm({ ...assignForm, isActive: e.target.checked })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="assignActive" className="text-xs text-slate-300 cursor-pointer">
                  Mark assignment ACTIVE immediately
                </label>
              </div>
            </form>

            {/* Modal Fixed Footer */}
            <div className="px-5 py-3.5 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-900">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 text-xs hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="assign-ad-form"
                disabled={assignSubmitting}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium shadow-md shadow-indigo-500/20 transition-colors"
              >
                {assignSubmitting ? 'Creating...' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Ad Rule Modal */}
      {showEditModal && editingRule && selectedUtility && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>✏️</span> Edit Ad Rule
                </h2>
                <p className="text-xs text-slate-400">
                  Targeting rule for <strong className="text-indigo-400">{selectedUtility.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRule(null);
                }}
                className="text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="edit-ad-form" onSubmit={handleSaveEditedRule} className="p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
              {/* Campaign (Parent entity, read-only display) */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Campaign</label>
                <div className="mt-1 px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 flex items-center justify-between">
                  <span className="font-semibold">{editingRule.campaign?.name || 'Assigned Campaign'}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      editingRule.campaign?.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {editingRule.campaign?.status || 'ACTIVE'}
                  </span>
                </div>
              </div>

              {/* Placement Slot */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Inventory Placement Slot</label>
                <select
                  required
                  value={editForm.placementId}
                  onChange={(e) => setEditForm({ ...editForm, placementId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">{placements.length === 0 ? '-- No Placements Available --' : '-- Choose Placement Slot --'}</option>
                  {placements.map((p) => {
                    let label = `${p.code} — ${p.name}`;
                    if (selectedUtility?.slug === 'home') {
                      if (p.code === 'MID_CONTENT') label = `MID_CONTENT — In-feed Banner (After PDF Tools)`;
                      if (p.code === 'AFTER_TOOL') label = `AFTER_TOOL — In-feed Banner (After Video Tools)`;
                      if (p.code === 'HEADER_BANNER') label = `HEADER_BANNER — Header Banner (Top of Page)`;
                      if (p.code === 'TOP_CONTENT') label = `TOP_CONTENT — Top Content Banner (Below Hero)`;
                      if (p.code === 'BOTTOM_CONTENT') label = `BOTTOM_CONTENT — Bottom Content Banner (Bottom of Page)`;
                    }
                    return (
                      <option key={p.id} value={p.id}>{label}</option>
                    );
                  })}
                </select>
              </div>

              {/* Ad Creative Mode / Source Tabs */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <label className="text-xs font-semibold text-slate-300">Ad Creative Configuration</label>
                <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, adMode: 'custom_image' })}
                    className={`flex-1 py-1.5 px-3 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      editForm.adMode === 'custom_image'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>🖼️ Custom Image Ad</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, adMode: 'library' })}
                    className={`flex-1 py-1.5 px-3 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      editForm.adMode === 'library'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>📚 Choose from Library</span>
                  </button>
                </div>
              </div>

              {/* Custom Image Ad Fields */}
              {editForm.adMode === 'custom_image' ? (
                <div className="space-y-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                  {/* 1. Image Dropzone / File Selector / URL Input */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <span>🖼️</span> Ad Banner Image
                      </label>
                      <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setImageInputMethodEdit('upload')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            imageInputMethodEdit === 'upload'
                              ? 'bg-indigo-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          📁 Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageInputMethodEdit('url')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            imageInputMethodEdit === 'url'
                              ? 'bg-indigo-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          🔗 URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowGalleryFor('edit')}
                          className="px-2.5 py-1 rounded-md bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors font-semibold border border-indigo-500/30 flex items-center gap-1"
                        >
                          <span>📸</span> Photo Gallery
                        </button>
                      </div>
                    </div>

                    {imageInputMethodEdit === 'upload' ? (
                      /* Drag and Drop Zone */
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingEdit(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsDraggingEdit(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingEdit(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleImageFileSelect(e.dataTransfer.files[0], true);
                          }
                        }}
                        onClick={() => {
                          const input = document.getElementById('edit-file-input');
                          if (input) input.click();
                        }}
                        className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                          isDraggingEdit
                            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                            : editForm.mediaUrl
                            ? 'border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-500/60'
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40'
                        }`}
                      >
                        <input
                          type="file"
                          id="edit-file-input"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageFileSelect(e.target.files[0], true);
                            }
                          }}
                          className="hidden"
                        />

                        <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-lg text-indigo-400">
                          {editForm.mediaUrl ? '✓' : '☁️'}
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-white">
                            {editForm.mediaUrl ? 'Click or drag new image to replace' : 'Click to select image or drag & drop here'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            PNG, JPG, WebP, SVG, GIF (Up to 10MB)
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Direct URL Input */
                      <div>
                        <input
                          type="url"
                          placeholder="https://example.com/images/ad-banner.png"
                          value={editForm.mediaUrl}
                          onChange={(e) => setEditForm({ ...editForm, mediaUrl: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    )}
                  </div>

                  {/* Live Banner Preview Box */}
                  {editForm.mediaUrl && (
                    <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-3 overflow-hidden flex flex-col items-center justify-center min-h-[90px] space-y-2">
                      <div className="w-full flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-slate-800/60 font-mono">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <span>●</span> Live Preview ({editForm.width} × {editForm.height}px)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditForm({ ...editForm, mediaUrl: '' });
                          }}
                          className="text-rose-400 hover:text-rose-300 font-medium"
                        >
                          ✕ Remove Image
                        </button>
                      </div>
                      <div className="flex items-center justify-center p-2 w-full bg-slate-900/50 rounded-lg border border-slate-800/60">
                        <img
                          src={editForm.mediaUrl}
                          alt="Ad preview"
                          style={{
                            maxHeight: editForm.sizeOrientation === 'vertical'
                              ? editForm.sizePreset === 'small' ? '120px' : '160px'
                              : editForm.sizePreset === 'small' ? '45px' : editForm.sizePreset === 'large' ? '110px' : '65px',
                            maxWidth: '100%',
                          }}
                          className="w-auto h-auto object-contain rounded-md shadow-xs"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 2. Banner Orientation & Size Selector */}
                  <div className="space-y-2.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <span>📐</span> Banner Size & Orientation
                      </label>
                      {/* Orientation Switcher */}
                      <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            const dims = BANNER_SIZES.horizontal[editForm.sizePreset];
                            setEditForm((prev) => ({
                              ...prev,
                              sizeOrientation: 'horizontal',
                              width: dims.width,
                              height: dims.height,
                            }));
                          }}
                          className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                            editForm.sizeOrientation === 'horizontal'
                              ? 'bg-indigo-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>↔</span> Horizontal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const dims = BANNER_SIZES.vertical[editForm.sizePreset];
                            setEditForm((prev) => ({
                              ...prev,
                              sizeOrientation: 'vertical',
                              width: dims.width,
                              height: dims.height,
                            }));
                          }}
                          className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                            editForm.sizeOrientation === 'vertical'
                              ? 'bg-indigo-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>↕</span> Vertical / Square
                        </button>
                      </div>
                    </div>

                    {/* Size Options (Small, Medium, Large) */}
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as const).map((key) => {
                        const opt = BANNER_SIZES[editForm.sizeOrientation][key];
                        const isSelected = editForm.sizePreset === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setEditForm((prev) => ({
                                ...prev,
                                sizePreset: key,
                                width: opt.width,
                                height: opt.height,
                              }));
                            }}
                            className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-sm ring-1 ring-indigo-500/50'
                                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-semibold text-white">{opt.label}</span>
                              {isSelected && <span className="text-[10px] text-indigo-400 font-bold">✓</span>}
                            </div>
                            <div className="text-[10px] font-mono text-indigo-300 font-medium mt-0.5">{opt.dimensions}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 truncate">{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Redirect Page URL */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span>🔗</span> Redirect Page URL (When user clicks on ad)
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://example.com/landing-page"
                      value={editForm.targetUrl}
                      onChange={(e) => setEditForm({ ...editForm, targetUrl: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Visitors who click on this ad banner will be redirected to this landing page.
                    </p>
                  </div>

                  {/* 3. Ad Title / Alt Text */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Ad Title / Alt Text (Optional)</label>
                    <input
                      type="text"
                      placeholder={`e.g. ${selectedUtility.name} Sponsor Banner`}
                      value={editForm.altText}
                      onChange={(e) => setEditForm({ ...editForm, altText: e.target.value, creativeName: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                /* Choose from Library */
                <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Select Creative Asset</label>
                    <select
                      required
                      value={editForm.creativeId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const found = creatives.find((c) => c.id === selectedId);
                        setEditForm({
                          ...editForm,
                          creativeId: selectedId,
                          mediaUrl: found?.mediaUrl || '',
                          targetUrl: found?.targetUrl || '',
                          creativeName: found?.name || '',
                          altText: found?.altText || found?.name || '',
                        });
                      }}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">{creatives.length === 0 ? '-- No Creatives Available --' : '-- Choose Creative Asset --'}</option>
                      {creatives.map((cr) => (
                        <option key={cr.id} value={cr.id}>
                          {cr.name} ({cr.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {editForm.mediaUrl && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      <div className="text-[11px] text-slate-400">
                        Image: <span className="font-mono text-indigo-400 truncate block">{editForm.mediaUrl}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Redirect: <span className="font-mono text-emerald-400 truncate block">{editForm.targetUrl || 'No target URL configured'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Device Targeting */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Device Targeting</label>
                <div className="flex items-center gap-4 mt-1.5">
                  {(['DESKTOP', 'TABLET', 'MOBILE'] as const).map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.deviceTypes.includes(d)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm({ ...editForm, deviceTypes: [...editForm.deviceTypes, d] });
                          } else {
                            setEditForm({
                              ...editForm,
                              deviceTypes: editForm.deviceTypes.filter((x) => x !== d),
                            });
                          }
                        }}
                        className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{d}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority & Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Priority Override</label>
                  <input
                    type="number"
                    placeholder="Optional (blank to inherit)"
                    value={editForm.priorityOverride}
                    onChange={(e) => setEditForm({ ...editForm, priorityOverride: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Weight (1–1000)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={editForm.weight}
                    onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) || 100 })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="editActive" className="text-xs text-slate-300">
                  Mark rule ACTIVE
                </label>
              </div>

            </form>

            {/* Modal Fixed Footer */}
            <div className="px-5 py-3.5 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRule(null);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 text-xs hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-ad-form"
                disabled={editSubmitting}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium shadow-md shadow-indigo-500/20 transition-colors"
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Ad Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>👁️</span> Live Production Ad Selector Preview
                </h2>
                <p className="text-xs text-slate-400">
                  Runs the real AdSelectorService logic to verify creative selection and explain fallback behavior
                </p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            {/* Simulation Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Target Utility</label>
                <select
                  value={previewUtilitySlug}
                  onChange={(e) => setPreviewUtilitySlug(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {matrix.map((u) => (
                    <option key={u.id} value={u.slug}>{u.name} (/{u.slug})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Device Type</label>
                <select
                  value={previewDevice}
                  onChange={(e) => setPreviewDevice(e.target.value as any)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="DESKTOP">DESKTOP</option>
                  <option value="TABLET">TABLET</option>
                  <option value="MOBILE">MOBILE</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Placement Slot</label>
                <select
                  value={previewPlacement}
                  onChange={(e) => setPreviewPlacement(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {placements.map((p) => (
                    <option key={p.id} value={p.code}>{p.code}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleRunPreview}
                disabled={previewLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-md"
              >
                {previewLoading ? 'Evaluating Selection Engine...' : 'Run Simulation'}
              </button>
            </div>

            {/* Preview Output */}
            {previewError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                {previewError}
              </div>
            )}

            {previewResult && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                {/* Fallback & Match Explanation Banner */}
                <div
                  className={`p-3.5 rounded-xl border space-y-1 ${
                    previewResult.explanation.code === 'EXACT_UTILITY'
                      ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                      : previewResult.explanation.code === 'CATEGORY'
                      ? 'bg-blue-950/40 border-blue-800/50 text-blue-300'
                      : previewResult.explanation.code === 'GLOBAL_PLACEMENT'
                      ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                      : previewResult.explanation.code === 'HOUSE_FALLBACK'
                      ? 'bg-indigo-950/40 border-indigo-800/50 text-indigo-300'
                      : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wide">
                      {previewResult.explanation.label}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30">
                      Tier: {previewResult.selectionTier}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {previewResult.explanation.description}
                  </p>
                </div>

                {/* Ad Visual Box */}
                {previewResult.selectedAd ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                      <span>Campaign: <strong className="text-white">{previewResult.selectedAd.campaignName}</strong></span>
                      <span>Format: <strong className="text-indigo-400 font-mono">{previewResult.selectedAd.creative.type}</strong></span>
                    </div>

                    {/* Creative Representation */}
                    <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-4 flex flex-col items-center justify-center text-center space-y-2 min-h-[140px]">
                      {previewResult.selectedAd.creative.headline && (
                        <h4 className="text-sm font-bold text-white">
                          {previewResult.selectedAd.creative.headline}
                        </h4>
                      )}
                      {previewResult.selectedAd.creative.body && (
                        <p className="text-xs text-slate-300 max-w-sm">
                          {previewResult.selectedAd.creative.body}
                        </p>
                      )}
                      {previewResult.selectedAd.creative.assetUrl && (
                        <div className="text-[10px] font-mono text-indigo-400 underline truncate max-w-xs">
                          {previewResult.selectedAd.creative.assetUrl}
                        </div>
                      )}
                      {previewResult.selectedAd.creative.callToAction && (
                        <span className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded text-xs font-semibold shadow">
                          {previewResult.selectedAd.creative.callToAction}
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono text-center">
                      Simulated Slot: {previewResult.placement} · Device: {previewResult.device}
                    </div>
                  </div>
                ) : (
                    <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-xl p-6 text-center space-y-1">
                      <p className="text-xs font-semibold text-rose-400">No ad selected</p>
                      <p className="text-[11px] text-slate-500">
                        No active targeting rules, category rules, or house ads matched this placement slot on {previewDevice}.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Photo Gallery Selector Modal */}
      <PhotoGalleryModal
        isOpen={showGalleryFor !== null}
        onClose={() => setShowGalleryFor(null)}
        onSelectPhoto={(photo) => {
          handleSelectPhotoFromGallery(photo, showGalleryFor === 'edit');
          setShowGalleryFor(null);
        }}
      />
    </div>
  );
}
