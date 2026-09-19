import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { notFoundHandler } from './middleware/notFoundHandler';

// Routes
import authRoutes from './routes/auth.routes';
import companyRoutes from './routes/company.routes';
import userRoutes from './routes/user.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import customerRoutes from './routes/customer.routes';
import supplierRoutes from './routes/supplier.routes';
import warehouseRoutes from './routes/warehouse.routes';
import invoiceRoutes from './routes/invoice.routes';
import quotationRoutes from './routes/quotation.routes';
import purchaseRoutes from './routes/purchase.routes';
import salesReturnRoutes from './routes/salesReturn.routes';
import purchaseReturnRoutes from './routes/purchaseReturn.routes';
import paymentRoutes from './routes/payment.routes';
import expenseRoutes from './routes/expense.routes';
import reportRoutes from './routes/report.routes';
import dashboardRoutes from './routes/dashboard.routes';
import staffRoutes from './routes/staff.routes';
import roleRoutes from './routes/role.routes';
import auditLogRoutes from './routes/auditLog.routes';
import notificationRoutes from './routes/notification.routes';
import settingsRoutes from './routes/settings.routes';
import templateRoutes from './routes/template.routes';
import supportRoutes from './routes/support.routes';
import superAdminRoutes from './routes/superAdmin.routes';
import uploadRoutes from './routes/upload.routes';

const app = express();

// ─── Security ───────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins (mobile apps, webviews, capacitor, electron, localhost, and cloud)
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id'],
}));
app.options('*', cors());

// ─── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use(limiter);

// ─── Body Parsing ────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files (Uploads) ──────────────────────────────────
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || './uploads'))
);

// ─── Request Logging ─────────────────────────────────────────
app.use(requestLogger);

// ─── Welcome / Root Route ────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: '🚀 CloudGST Pro API is running live on the cloud!',
    version: '1.0.0',
    status: 'online',
    health: '/health',
    endpoints: '/api/v1',
  });
});

// ─── Health Check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'CloudGST Pro API'
  });
});

// ─── API Routes ──────────────────────────────────────────────
const API = '/api/v1';

app.use(`${API}/auth`, authLimiter, authRoutes);
app.use(`${API}/companies`, companyRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/products`, productRoutes);
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/customers`, customerRoutes);
app.use(`${API}/suppliers`, supplierRoutes);
app.use(`${API}/warehouses`, warehouseRoutes);
app.use(`${API}/invoices`, invoiceRoutes);
app.use(`${API}/quotations`, quotationRoutes);
app.use(`${API}/purchases`, purchaseRoutes);
app.use(`${API}/sales-returns`, salesReturnRoutes);
app.use(`${API}/purchase-returns`, purchaseReturnRoutes);
app.use(`${API}/payments`, paymentRoutes);
app.use(`${API}/expenses`, expenseRoutes);
app.use(`${API}/reports`, reportRoutes);
app.use(`${API}/dashboard`, dashboardRoutes);
app.use(`${API}/staff`, staffRoutes);
app.use(`${API}/roles`, roleRoutes);
app.use(`${API}/audit-logs`, auditLogRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/settings`, settingsRoutes);
app.use(`${API}/templates`, templateRoutes);
app.use(`${API}/support`, supportRoutes);
app.use(`${API}/super-admin`, superAdminRoutes);
app.use(`${API}/upload`, uploadRoutes);

// ─── Error Handling ──────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
