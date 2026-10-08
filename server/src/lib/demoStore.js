import { readFileSync } from 'node:fs';
import { checkCompleteness } from '../services/quality.js';
import { analyzeRetailerCatalog } from '../services/retailerIntelligence.js';

const SAMPLE_FILE = new URL('../../../data/generated/products.json', import.meta.url);

class DemoStore {
  constructor() {
    this.retailer = null;
    this.profile = null;
    this.products = [];
    this.descriptions = new Map(); // descId -> description
    this.feedback = new Map(); // descId -> [feedbacks]
    this.evidence = new Map(); // descId -> traces
    this.loadSampleProducts();
  }

  loadSampleProducts() {
    try {
      const raw = JSON.parse(readFileSync(SAMPLE_FILE, 'utf8'));
      this.products = raw.map((item, idx) => {
        const id = `demo-prod-${item.sku ? item.sku.toLowerCase() : idx + 1}`;
        const completeness = checkCompleteness(item).score;
        return {
          id,
          retailer_id: 'demo-retailer-123',
          sku: item.sku || `SKU-${String(idx + 1).padStart(4, '0')}`,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory || null,
          brand: item.brand || 'Voltix',
          price: item.price ?? 2999,
          currency: item.currency || 'INR',
          features: Array.isArray(item.features) ? item.features : [],
          specifications: item.specifications || {},
          attributes: item.attributes || {},
          image_url: item.image_url || null,
          seed_keywords: item.seed_keywords || [],
          completeness_score: completeness,
          source: 'synthetic',
          created_at: new Date().toISOString(),
          descriptions: [],
        };
      });
    } catch {
      this.products = [];
    }
  }

  getRetailer() {
    return this.retailer;
  }

  async setRetailer(data) {
    this.retailer = {
      id: 'demo-retailer-123',
      owner_id: 'demo-user-123',
      ...data,
      created_at: this.retailer?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.profile = await analyzeRetailerCatalog(this.retailer, this.products.slice(0, 10));
    return this.retailer;
  }

  getProfile() {
    return this.profile;
  }

  setProfile(profile) {
    this.profile = profile;
  }

  listProducts({ category, search } = {}) {
    let list = [...this.products];
    if (category) {
      list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    }
    return list.map((p) => {
      const descs = p.descriptions || [];
      const latest = descs.slice().sort((a, b) => b.version - a.version)[0] || null;
      return {
        ...p,
        latest_description: latest,
        description_count: descs.length,
      };
    });
  }

  getProduct(id) {
    const product = this.products.find((p) => p.id === id);
    if (!product) return null;
    const descs = product.descriptions || [];
    return {
      product,
      descriptions: descs.slice().sort((a, b) => b.version - a.version),
    };
  }

  addDescription(productId, descData, evidenceTraces = []) {
    const product = this.products.find((p) => p.id === productId);
    if (!product) return null;
    const version = (product.descriptions.length || 0) + 1;
    const descId = `desc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newDesc = {
      id: descId,
      product_id: productId,
      version,
      status: 'draft',
      created_at: new Date().toISOString(),
      ...descData,
    };
    product.descriptions.unshift(newDesc);
    this.descriptions.set(descId, newDesc);
    if (evidenceTraces?.length) {
      this.evidence.set(descId, evidenceTraces);
    }
    return newDesc;
  }

  updateDescription(descId, patch) {
    for (const prod of this.products) {
      const found = prod.descriptions.find((d) => d.id === descId);
      if (found) {
        Object.assign(found, patch);
        return found;
      }
    }
    return null;
  }

  getEvidence(descId) {
    return this.evidence.get(descId) || [];
  }

  saveFeedback(descId, feedback) {
    const list = this.feedback.get(descId) || [];
    list.push({ ...feedback, created_at: new Date().toISOString() });
    this.feedback.set(descId, list);
    return list;
  }
}

export const demoStore = new DemoStore();
