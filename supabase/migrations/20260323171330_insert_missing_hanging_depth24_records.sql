/*
  # Insert missing 80 Closet Hanging depth-24 records

  ## Summary
  The closet_catalog table was missing 80 records from the official 2025 price list CSV.
  All 80 missing records are depth-24 (24-inch deep) variants of the Closet Hanging and
  Closet Tall Hanging categories, for both Evita Plus and Evita Premium lines.

  ## What was missing
  - Evita Plus Hanging depth-24: 40 records (10 heights × 4 widths)
    Heights: 36, 39, 42, 51, 63 (Closet Hanging) and 69, 75, 81, 87, 93 (Closet Tall Hanging)
    Widths: 18, 24, 30, 36 inches
    Cabinet codes: H{width}{height}24 format (e.g., H183624)

  - Evita Premium Hanging depth-24: 40 records (same structure, codes with _EPR suffix)
    Cabinet codes: H{width}{height}24_EPR format (e.g., H183624_EPR)

  ## Security
  - No RLS changes needed (existing closet_catalog policies apply)
*/

INSERT INTO closet_catalog (cabinet_code, evita_line, description, height_in, width_in, depth_in, price_with_backs_usd, price_without_backs_usd, has_backs_option, boxes_count) VALUES

-- Evita Plus - Closet Hanging depth-24 (heights 36-63)
('H183624','Evita Plus','Hanging',36,18,24,80.89,79.47,true,1),
('H243624','Evita Plus','Hanging',36,24,24,87.54,85.45,true,1),
('H303624','Evita Plus','Hanging',36,30,24,94.18,91.43,true,1),
('H363624','Evita Plus','Hanging',36,36,24,100.82,97.41,true,1),

('H183924','Evita Plus','Hanging',39,18,24,83.55,81.86,true,1),
('H243924','Evita Plus','Hanging',39,24,24,90.42,88.04,true,1),
('H303924','Evita Plus','Hanging',39,30,24,97.28,94.22,true,1),
('H363924','Evita Plus','Hanging',39,36,24,104.14,100.40,true,1),

('H184224','Evita Plus','Hanging',42,18,24,86.21,84.26,true,1),
('H244224','Evita Plus','Hanging',42,24,24,93.30,90.63,true,1),
('H304224','Evita Plus','Hanging',42,30,24,100.38,97.01,true,1),
('H364224','Evita Plus','Hanging',42,36,24,107.46,103.38,true,1),

('H185124','Evita Plus','Hanging',51,18,24,94.19,91.44,true,1),
('H245124','Evita Plus','Hanging',51,24,24,101.94,98.41,true,1),
('H305124','Evita Plus','Hanging',51,30,24,109.68,105.38,true,1),
('H365124','Evita Plus','Hanging',51,36,24,117.43,112.35,true,1),

('H186324','Evita Plus','Hanging',63,18,24,104.83,101.02,true,1),
('H246324','Evita Plus','Hanging',63,24,24,113.46,108.78,true,1),
('H306324','Evita Plus','Hanging',63,30,24,122.09,116.55,true,1),
('H366324','Evita Plus','Hanging',63,36,24,130.72,124.31,true,1),

-- Evita Plus - Closet Tall Hanging depth-24 (heights 69-93)
('H186924','Evita Plus','Tall Hanging',69,18,24,110.15,105.81,true,1),
('H246924','Evita Plus','Tall Hanging',69,24,24,119.22,113.97,true,1),
('H306924','Evita Plus','Tall Hanging',69,30,24,128.29,122.13,true,1),
('H366924','Evita Plus','Tall Hanging',69,36,24,137.36,130.29,true,1),

('H187524','Evita Plus','Tall Hanging',75,18,24,115.47,110.59,true,1),
('H247524','Evita Plus','Tall Hanging',75,24,24,124.98,119.15,true,1),
('H307524','Evita Plus','Tall Hanging',75,30,24,134.49,127.71,true,1),
('H367524','Evita Plus','Tall Hanging',75,36,24,144.00,136.27,true,1),

('H188124','Evita Plus','Tall Hanging',81,18,24,120.80,115.38,true,1),
('H248124','Evita Plus','Tall Hanging',81,24,24,130.75,124.34,true,1),
('H308124','Evita Plus','Tall Hanging',81,30,24,140.70,133.29,true,1),
('H368124','Evita Plus','Tall Hanging',81,36,24,150.65,142.25,true,1),

('H188724','Evita Plus','Tall Hanging',87,18,24,126.12,120.17,true,1),
('H248724','Evita Plus','Tall Hanging',87,24,24,136.51,129.52,true,1),
('H308724','Evita Plus','Tall Hanging',87,30,24,146.90,138.87,true,1),
('H368724','Evita Plus','Tall Hanging',87,36,24,157.29,148.23,true,1),

('H189324','Evita Plus','Tall Hanging',93,18,24,131.44,124.96,true,1),
('H249324','Evita Plus','Tall Hanging',93,24,24,142.27,134.71,true,1),
('H309324','Evita Plus','Tall Hanging',93,30,24,153.10,144.46,true,1),
('H369324','Evita Plus','Tall Hanging',93,36,24,163.93,154.21,true,1),

-- Evita Premium - Closet Hanging depth-24 (heights 36-63)
('H183624_EPR','Evita Premium','Hanging',36,18,24,158.20,149.05,true,1),
('H243624_EPR','Evita Premium','Hanging',36,24,24,176.52,165.53,true,1),
('H303624_EPR','Evita Premium','Hanging',36,30,24,194.84,182.02,true,1),
('H363624_EPR','Evita Premium','Hanging',36,36,24,213.16,198.51,true,1),

('H183924_EPR','Evita Premium','Hanging',39,18,24,165.49,155.61,true,1),
('H243924_EPR','Evita Premium','Hanging',39,24,24,184.43,172.66,true,1),
('H303924_EPR','Evita Premium','Hanging',39,30,24,203.38,189.70,true,1),
('H363924_EPR','Evita Premium','Hanging',39,36,24,222.32,206.75,true,1),

('H184224_EPR','Evita Premium','Hanging',42,18,24,172.78,162.17,true,1),
('H244224_EPR','Evita Premium','Hanging',42,24,24,192.34,179.78,true,1),
('H304224_EPR','Evita Premium','Hanging',42,30,24,211.91,197.39,true,1),
('H364224_EPR','Evita Premium','Hanging',42,36,24,231.48,215.00,true,1),

('H185124_EPR','Evita Premium','Hanging',51,18,24,194.65,181.85,true,1),
('H245124_EPR','Evita Premium','Hanging',51,24,24,216.08,201.14,true,1),
('H305124_EPR','Evita Premium','Hanging',51,30,24,237.52,220.43,true,1),
('H365124_EPR','Evita Premium','Hanging',51,36,24,258.96,239.73,true,1),

('H186324_EPR','Evita Premium','Hanging',63,18,24,223.80,208.09,true,1),
('H246324_EPR','Evita Premium','Hanging',63,24,24,247.73,229.62,true,1),
('H306324_EPR','Evita Premium','Hanging',63,30,24,271.66,251.16,true,1),
('H366324_EPR','Evita Premium','Hanging',63,36,24,295.59,272.70,true,1),

-- Evita Premium - Closet Tall Hanging depth-24 (heights 69-93)
('H186924_EPR','Evita Premium','Tall Hanging',69,18,24,238.38,221.21,true,1),
('H246924_EPR','Evita Premium','Tall Hanging',69,24,24,263.56,243.87,true,1),
('H306924_EPR','Evita Premium','Tall Hanging',69,30,24,288.74,266.53,true,1),
('H366924_EPR','Evita Premium','Tall Hanging',69,36,24,313.92,289.19,true,1),

('H187524_EPR','Evita Premium','Tall Hanging',75,18,24,252.96,234.33,true,1),
('H247524_EPR','Evita Premium','Tall Hanging',75,24,24,279.38,258.11,true,1),
('H307524_EPR','Evita Premium','Tall Hanging',75,30,24,305.81,281.89,true,1),
('H367524_EPR','Evita Premium','Tall Hanging',75,36,24,332.23,305.68,true,1),

('H188124_EPR','Evita Premium','Tall Hanging',81,18,24,267.54,247.45,true,1),
('H248124_EPR','Evita Premium','Tall Hanging',81,24,24,295.21,272.35,true,1),
('H308124_EPR','Evita Premium','Tall Hanging',81,30,24,322.88,297.26,true,1),
('H368124_EPR','Evita Premium','Tall Hanging',81,36,24,350.55,322.16,true,1),

('H188724_EPR','Evita Premium','Tall Hanging',87,18,24,282.11,260.57,true,1),
('H248724_EPR','Evita Premium','Tall Hanging',87,24,24,311.03,286.59,true,1),
('H308724_EPR','Evita Premium','Tall Hanging',87,30,24,339.95,312.62,true,1),
('H368724_EPR','Evita Premium','Tall Hanging',87,36,24,368.87,338.65,true,1),

('H189324_EPR','Evita Premium','Tall Hanging',93,18,24,296.69,273.69,true,1),
('H249324_EPR','Evita Premium','Tall Hanging',93,24,24,326.86,300.84,true,1),
('H309324_EPR','Evita Premium','Tall Hanging',93,30,24,357.02,327.99,true,1),
('H369324_EPR','Evita Premium','Tall Hanging',93,36,24,387.19,355.14,true,1)

ON CONFLICT (cabinet_code) DO NOTHING;
