import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil as Edit2, Tag, Package, Ruler, Box, Layers,
  Check, X, Clock, BarChart3, Warehouse
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Spec({ label, value, unit }: { label: string; value: string | number | null | undefined; unit?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-200/40 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 tabular-nums">{typeof value === 'number' ? value.toFixed(2) : value}{unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

export function ProductItem() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageCount, setUsageCount] = useState<number>(0);

  useEffect(() => {
    if (!id) { navigate('/products', { replace: true }); return; }

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('products_catalog')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        navigate('/products', { replace: true });
        return;
      }
      setProduct(data);
      setLoading(false);

      const { count } = await supabase
        .from('area_cabinets')
        .select('id', { count: 'exact', head: true })
        .eq('product_sku', data.sku);
      setUsageCount(count || 0);
    }

    load();
  }, [id, navigate]);

  if (loading || !product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-500 text-sm">Loading product...</div>
      </div>
    );
  }

  const isArchived = product.status === 'archived' || !product.is_active;

  return (
    <div className="space-y-5">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/products')}
            className="flex-shrink-0 p-2 rounded-xl bg-white/60 hover:bg-white/80 border border-slate-200/50 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <button onClick={() => navigate('/products')} className="hover:text-blue-600 transition-colors">Cabinets</button>
              <span>/</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900 truncate">{product.sku}</h1>
          </div>
        </div>
        <button
          onClick={() => navigate(`/products?edit=${product.id}`)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600/90 hover:bg-blue-700 rounded-xl transition-colors shadow-sm flex-shrink-0"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>

      {/* Hero header */}
      <div className="rounded-xl px-5 sm:px-7 py-5 sm:py-6" style={{ background: 'linear-gradient(135deg, rgba(219,234,254,0.4), rgba(224,231,255,0.3), rgba(241,245,249,0.35))', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
        <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-600/10 text-blue-800 border border-blue-600/15">
              <Package className="h-3 w-3" />
              {product.collection_name || 'Standard Catalog'}
            </span>
            {product.has_drawers && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/15">
                <Layers className="h-3 w-3" />
                Has Drawers
              </span>
            )}
          </div>
          {isArchived ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/50">Archived</span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200/50">Active</span>
          )}
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">{product.description}</h2>
        <p className="mt-1 text-sm text-slate-400 font-mono">{product.sku}</p>

        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{product.box_sf.toFixed(1)}</div>
              <span className="text-xs text-slate-500">Box SF</span>
            </div>
            <div className="w-px h-8 bg-slate-300/50" />
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{product.doors_fronts_sf.toFixed(1)}</div>
              <span className="text-xs text-slate-500">Doors SF</span>
            </div>
            <div className="w-px h-8 bg-slate-300/50" />
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{product.total_edgeband.toFixed(1)}</div>
              <span className="text-xs text-slate-500">EB (m)</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">Updated {formatDate(product.updated_at)}</span>
          </div>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Material Specs */}
          <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Ruler className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Material Specifications</h3>
            </div>
            <Spec label="Box Square Feet" value={product.box_sf} unit="sf" />
            <Spec label="Doors / Fronts SF" value={product.doors_fronts_sf} unit="sf" />
            <Spec label="Box Edgeband" value={product.box_edgeband} unit="m" />
            <Spec label="Box Edgeband Color" value={product.box_edgeband_color} unit="m" />
            <Spec label="Doors Edgeband" value={product.doors_fronts_edgeband} unit="m" />
            <Spec label="Total Edgeband" value={product.total_edgeband} unit="m" />
          </div>

          {/* Production */}
          <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Box className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Production</h3>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200/40">
              <span className="text-sm text-slate-500">Has Drawers</span>
              {product.has_drawers ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-slate-300" />}
            </div>
            <Spec label="Boxes per Unit" value={product.boxes_per_unit ?? 1} />
            <div className="flex items-center justify-between py-2 border-b border-slate-200/40">
              <span className="text-sm text-slate-500">RTA Default</span>
              {product.default_is_rta ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-slate-300" />}
            </div>
            <Spec label="Custom Labor Cost" value={product.custom_labor_cost !== null && product.custom_labor_cost !== undefined ? `$${product.custom_labor_cost.toFixed(2)}` : 'Global'} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Usage */}
          <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Usage</h3>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Used in cabinet lines</span>
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{usageCount}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Across all project areas</p>
          </div>

          {/* Waste Info */}
          {(product.original_box_sf != null || product.original_doors_fronts_sf != null) && (
            <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Warehouse className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Waste Adjustment</h3>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-200/40">
                <span className="text-sm text-slate-500">Waste Applied</span>
                {product.waste_applied ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-slate-300" />}
              </div>
              {product.original_box_sf != null && (
                <Spec label="Original Box SF" value={product.original_box_sf} unit="sf" />
              )}
              {product.original_doors_fronts_sf != null && (
                <Spec label="Original Doors SF" value={product.original_doors_fronts_sf} unit="sf" />
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Metadata</h3>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Collection</span>
                <span>{product.collection_name || 'Standard Catalog'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <span className={isArchived ? 'text-slate-500' : 'text-green-600'}>{isArchived ? 'Archived' : 'Active'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Created</span>
                <span>{formatDate(product.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Updated</span>
                <span>{formatDate(product.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
