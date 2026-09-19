import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profilePhoto?: string;
  isSuperAdmin: boolean;
}

export interface CompanyAccess {
  companyId: string;
  companyName: string;
  logoPath?: string;
  signaturePath?: string;
  gstin?: string;
  isOwner: boolean;
  role: { id: string; name: string; displayName: string };
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  companies: CompanyAccess[];
  currentCompanyId: string | null;
  currentCompany: CompanyAccess | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (data: { user: User; accessToken: string; refreshToken: string; companies: CompanyAccess[] }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setCompanies: (companies: CompanyAccess[]) => void;
  updateCurrentCompany: (patch: Partial<CompanyAccess>) => void;
  switchCompany: (companyId: string) => void;
  logout: () => void;
}

// ─── Auth Store ───────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      companies: [],
      currentCompanyId: null,
      currentCompany: null,
      isAuthenticated: false,

      setAuth: ({ user, accessToken, refreshToken, companies }) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        const currentCompanyId = companies[0]?.companyId ?? null;
        if (currentCompanyId) {
          localStorage.setItem('currentCompanyId', currentCompanyId);
        }

        set({
          user,
          accessToken,
          refreshToken,
          companies,
          currentCompanyId,
          currentCompany: companies[0] ?? null,
          isAuthenticated: true,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ accessToken, refreshToken });
      },

      setCompanies: (companies) => {
        const { currentCompanyId } = get();
        const currentCompany = companies.find((c) => c.companyId === currentCompanyId) ?? companies[0] ?? null;
        set({ companies, currentCompany });
      },

      updateCurrentCompany: (patch) => {
        const { currentCompany, companies, currentCompanyId } = get();
        if (!currentCompany) return;
        const updated = { ...currentCompany, ...patch };
        const updatedCompanies = companies.map((c) => (c.companyId === currentCompanyId ? { ...c, ...patch } : c));
        set({ currentCompany: updated, companies: updatedCompanies });
      },

      switchCompany: (companyId) => {
        const { companies } = get();
        const company = companies.find((c) => c.companyId === companyId);
        if (!company) return;
        localStorage.setItem('currentCompanyId', companyId);
        set({ currentCompanyId: companyId, currentCompany: company });
      },

      logout: () => {
        localStorage.clear();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          companies: [],
          currentCompanyId: null,
          currentCompany: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'cloudgst-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        companies: state.companies,
        currentCompanyId: state.currentCompanyId,
        currentCompany: state.currentCompany,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ─── UI Store ─────────────────────────────────────────────────────

interface UIState {
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  toggleSidebar: () => void;
  setMobileMenu: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileMenuOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileMenu: (open) => set({ mobileMenuOpen: open }),
    }),
    { name: 'cloudgst-ui', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) }
  )
);

// ─── POS Cart Store ───────────────────────────────────────────────

export interface CartItem {
  id: string;           // temp id
  productId?: string;
  warehouseId?: string;
  description: string;
  hsnCode?: string;
  quantity: string;
  unit?: string;
  rate: number;         // rupees
  discountPercent: string;
  gstRate: string;
  cessRate: string;
  taxType?: 'inclusive' | 'exclusive';
  // Calculated
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalAmount?: number;
}

export interface CartState {
  items: CartItem[];
  customerId?: string;
  isInterState: boolean;
  invoiceDiscountPercent: string;
  paymentMethod: string;
  notes: string;

  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateItem: (id: string, updates: Partial<CartItem>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  setCustomer: (customerId?: string) => void;
  setInterState: (isInterState: boolean) => void;
  setInvoiceDiscount: (percent: string) => void;
  setPaymentMethod: (method: string) => void;
  setNotes: (notes: string) => void;
}

export const useCartStore = create<CartState>()((set) => ({
  items: [],
  customerId: undefined,
  isInterState: false,
  invoiceDiscountPercent: '0',
  paymentMethod: 'cash',
  notes: '',

  addItem: (item) =>
    set((state) => ({
      items: [
        ...state.items,
        { ...item, id: `cart-${Date.now()}-${Math.random()}` },
      ],
    })),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    })),

  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) })),

  clearCart: () =>
    set({ items: [], customerId: undefined, invoiceDiscountPercent: '0', notes: '' }),

  setCustomer: (customerId) => set({ customerId }),
  setInterState: (isInterState) => set({ isInterState }),
  setInvoiceDiscount: (invoiceDiscountPercent) => set({ invoiceDiscountPercent }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setNotes: (notes) => set({ notes }),
}));
