-- Migration 0007: Document Matrix Mapping Configurator Table
CREATE TABLE IF NOT EXISTS loan_product_doc_mappings (
  product_label TEXT PRIMARY KEY,
  required_doc_ids JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
