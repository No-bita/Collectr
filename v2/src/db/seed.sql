-- Seed placeholder data for Collectrr v2 testing

INSERT OR IGNORE INTO loan_cases (id, contact_person, phone_number, loan_product, amount_required, status, created_at, last_updated) VALUES
('case_101', 'Ramesh Sharma', '919876543210', 'Working Capital', 25.0, 'ready_for_review', datetime('now', '-3 days'), datetime('now', '-10 minutes')),
('case_102', 'Anita Verma', '919812345678', 'Machinery Loan', 50.0, 'documents_pending', datetime('now', '-2 days'), datetime('now', '-1 hour')),
('case_103', 'Vikram Patel', '919988776655', 'Loan Against Property (LAP)', 120.0, 'submitted', datetime('now', '-5 days'), datetime('now', '-30 minutes')),
('case_104', 'Suresh Gupta', '919765432109', 'Cash Credit', 15.0, 'lender_query', datetime('now', '-6 days'), datetime('now', '-2 hours')),
('case_105', 'Priya Nair', '919654321098', 'Term Loan', 80.0, 'disbursed', datetime('now', '-10 days'), datetime('now', '-1 day')),
('case_106', 'Rajesh Mehta', '919543210987', 'Invoice Financing', 10.0, 'lead', datetime('now', '-1 hour'), datetime('now', '-5 minutes'));

-- Required Documents for Case 101 (Ramesh Sharma)
INSERT OR IGNORE INTO required_documents (id, case_id, document_type, label, status) VALUES
('req_101_1', 'case_101', 'pan', 'PAN Card', 'received'),
('req_101_2', 'case_101', 'aadhaar', 'Aadhaar Card', 'received'),
('req_101_3', 'case_101', 'bank_statement', 'Bank Statement', 'received'),
('req_101_4', 'case_101', 'gst_returns', 'GST Returns', 'received');

-- Uploaded Documents for Case 101
INSERT OR IGNORE INTO uploaded_documents (id, case_id, required_doc_id, file_label, s3_key, content_type, ocr_status) VALUES
('up_101_1', 'case_101', 'req_101_1', 'PAN Card Copy', 'case_101/Ramesh_Sharma_pan_01', 'image/jpeg', 'processed'),
('up_101_2', 'case_101', 'req_101_2', 'Aadhaar Card Front & Back', 'case_101/Ramesh_Sharma_aadhaar_02', 'application/pdf', 'processed'),
('up_101_3', 'case_101', 'req_101_3', 'HDFC Bank Statement 6M', 'case_101/Ramesh_Sharma_bank_statement_03', 'application/pdf', 'processed'),
('up_101_4', 'case_101', 'req_101_4', 'GST Return 3B FY23-24', 'case_101/Ramesh_Sharma_gst_returns_04', 'application/pdf', 'processed');

-- Required Documents for Case 102 (Anita Verma)
INSERT OR IGNORE INTO required_documents (id, case_id, document_type, label, status) VALUES
('req_102_1', 'case_102', 'pan', 'PAN Card', 'pending'),
('req_102_2', 'case_102', 'aadhaar', 'Aadhaar Card', 'pending'),
('req_102_3', 'case_102', 'quotation', 'Machinery/Equipment Quotation', 'received'),
('req_102_4', 'case_102', 'bank_statement', 'Bank Statement', 'pending');

INSERT OR IGNORE INTO uploaded_documents (id, case_id, required_doc_id, file_label, s3_key, content_type, ocr_status) VALUES
('up_102_1', 'case_102', 'req_102_3', 'CNC Machine Quotation - Voltas', 'case_102/Anita_Verma_quotation_01', 'application/pdf', 'processed');

-- Required Documents for Case 103 (Vikram Patel)
INSERT OR IGNORE INTO required_documents (id, case_id, document_type, label, status) VALUES
('req_103_1', 'case_103', 'pan', 'PAN Card', 'received'),
('req_103_2', 'case_103', 'property_docs', 'Property Ownership Documents', 'received'),
('req_103_3', 'case_103', 'itr', 'ITR Acknowledgment', 'received');

INSERT OR IGNORE INTO uploaded_documents (id, case_id, required_doc_id, file_label, s3_key, content_type, ocr_status) VALUES
('up_103_1', 'case_103', 'req_103_1', 'PAN Card Original', 'case_103/Vikram_Patel_pan_01', 'image/jpeg', 'processed'),
('up_103_2', 'case_103', 'req_103_2', 'Commercial Property Title Deed', 'case_103/Vikram_Patel_property_02', 'application/pdf', 'processed'),
('up_103_3', 'case_103', 'req_103_3', 'ITR Return FY22-23 & FY23-24', 'case_103/Vikram_Patel_itr_03', 'application/pdf', 'processed');

-- Case Timeline Entries
INSERT OR IGNORE INTO case_timeline (id, case_id, event_type, content, created_by, created_at) VALUES
('time_101_1', 'case_101', 'case_created', 'Loan Case created for Ramesh Sharma', 'agent', datetime('now', '-3 days')),
('time_101_2', 'case_101', 'whatsapp_sent', 'WhatsApp upload link sent to client', 'system', datetime('now', '-3 days')),
('time_101_3', 'case_101', 'document_uploaded', 'Client uploaded HDFC Bank Statement 6M', 'system', datetime('now', '-1 day')),
('time_101_4', 'case_101', 'status_change', 'Status auto-updated to Ready for Review (All required documents received)', 'system', datetime('now', '-10 minutes')),

('time_103_1', 'case_103', 'case_created', 'Loan Case created for Vikram Patel (LAP)', 'agent', datetime('now', '-5 days')),
('time_103_2', 'case_103', 'status_change', 'Submitted to ICICI Bank Commercial Lending team', 'agent', datetime('now', '-30 minutes'));
