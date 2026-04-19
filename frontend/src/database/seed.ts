import * as SQLite from 'expo-sqlite';

function generateSeedId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

export async function seedMedicines(db: SQLite.SQLiteDatabase): Promise<void> {
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM medicines');
  if (count && count.c > 0) return;

  const medicines = [
    // Antibiotics
    { name: 'Amoxicillin 500mg', type: 'Capsule', strength: '500mg', manufacturer: 'Cipla' },
    { name: 'Amoxicillin 250mg', type: 'Capsule', strength: '250mg', manufacturer: 'Cipla' },
    { name: 'Augmentin 625mg', type: 'Tablet', strength: '625mg', manufacturer: 'GSK' },
    { name: 'Augmentin 375mg', type: 'Tablet', strength: '375mg', manufacturer: 'GSK' },
    { name: 'Azithromycin 500mg', type: 'Tablet', strength: '500mg', manufacturer: 'Alkem' },
    { name: 'Azithromycin 250mg', type: 'Tablet', strength: '250mg', manufacturer: 'Alkem' },
    { name: 'Ciprofloxacin 500mg', type: 'Tablet', strength: '500mg', manufacturer: 'Cipla' },
    { name: 'Cefixime 200mg', type: 'Tablet', strength: '200mg', manufacturer: 'Mankind' },
    { name: 'Cefpodoxime 200mg', type: 'Tablet', strength: '200mg', manufacturer: 'Lupin' },
    { name: 'Doxycycline 100mg', type: 'Capsule', strength: '100mg', manufacturer: 'Sun Pharma' },
    { name: 'Metronidazole 400mg', type: 'Tablet', strength: '400mg', manufacturer: 'Abbott' },
    { name: 'Levofloxacin 500mg', type: 'Tablet', strength: '500mg', manufacturer: 'Cipla' },
    { name: 'Ofloxacin 200mg', type: 'Tablet', strength: '200mg', manufacturer: 'Cipla' },
    { name: 'Clindamycin 300mg', type: 'Capsule', strength: '300mg', manufacturer: 'Intas' },
    { name: 'Norfloxacin 400mg', type: 'Tablet', strength: '400mg', manufacturer: 'Cipla' },

    // Pain / Anti-inflammatory
    { name: 'Paracetamol 500mg', type: 'Tablet', strength: '500mg', manufacturer: 'GSK' },
    { name: 'Paracetamol 650mg', type: 'Tablet', strength: '650mg', manufacturer: 'Micro Labs' },
    { name: 'Ibuprofen 400mg', type: 'Tablet', strength: '400mg', manufacturer: 'Cipla' },
    { name: 'Diclofenac 50mg', type: 'Tablet', strength: '50mg', manufacturer: 'Novartis' },
    { name: 'Aceclofenac 100mg', type: 'Tablet', strength: '100mg', manufacturer: 'IPCA' },
    { name: 'Naproxen 500mg', type: 'Tablet', strength: '500mg', manufacturer: 'Sun Pharma' },
    { name: 'Nimesulide 100mg', type: 'Tablet', strength: '100mg', manufacturer: 'Panacea' },
    { name: 'Combiflam', type: 'Tablet', strength: '400+325mg', manufacturer: 'Sanofi' },
    { name: 'Flexon MR', type: 'Tablet', strength: '500mg', manufacturer: 'Aristo' },
    { name: 'Zerodol SP', type: 'Tablet', strength: '100+15+325mg', manufacturer: 'IPCA' },
    { name: 'Tramadol 50mg', type: 'Capsule', strength: '50mg', manufacturer: 'Intas' },

    // Gastro
    { name: 'Pantoprazole 40mg', type: 'Tablet', strength: '40mg', manufacturer: 'Alkem' },
    { name: 'Omeprazole 20mg', type: 'Capsule', strength: '20mg', manufacturer: 'Dr. Reddys' },
    { name: 'Rabeprazole 20mg', type: 'Tablet', strength: '20mg', manufacturer: 'Cadila' },
    { name: 'Domperidone 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'Torrent' },
    { name: 'Ondansetron 4mg', type: 'Tablet', strength: '4mg', manufacturer: 'Sun Pharma' },
    { name: 'Sucralfate 1g', type: 'Syrup', strength: '1g/5ml', manufacturer: 'Abbott' },
    { name: 'Ranitidine 150mg', type: 'Tablet', strength: '150mg', manufacturer: 'Cipla' },
    { name: 'Dicyclomine 20mg', type: 'Tablet', strength: '20mg', manufacturer: 'Abbott' },
    { name: 'Mebeverine 135mg', type: 'Tablet', strength: '135mg', manufacturer: 'Abbott' },
    { name: 'ORS Powder', type: 'Powder', strength: '21.8g', manufacturer: 'WHO Formula' },

    // Antihistamines / Allergy
    { name: 'Cetirizine 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'Dr. Reddys' },
    { name: 'Levocetirizine 5mg', type: 'Tablet', strength: '5mg', manufacturer: 'Glenmark' },
    { name: 'Fexofenadine 120mg', type: 'Tablet', strength: '120mg', manufacturer: 'Sanofi' },
    { name: 'Fexofenadine 180mg', type: 'Tablet', strength: '180mg', manufacturer: 'Sanofi' },
    { name: 'Montelukast 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'Sun Pharma' },
    { name: 'Chlorpheniramine 4mg', type: 'Tablet', strength: '4mg', manufacturer: 'GSK' },
    { name: 'Hydroxyzine 25mg', type: 'Tablet', strength: '25mg', manufacturer: 'UCB' },

    // Respiratory
    { name: 'Salbutamol 4mg', type: 'Tablet', strength: '4mg', manufacturer: 'Cipla' },
    { name: 'Salbutamol Inhaler', type: 'Inhaler', strength: '100mcg', manufacturer: 'Cipla' },
    { name: 'Budesonide Inhaler', type: 'Inhaler', strength: '200mcg', manufacturer: 'Cipla' },
    { name: 'Dextromethorphan Syrup', type: 'Syrup', strength: '10mg/5ml', manufacturer: 'Abbott' },
    { name: 'Ambroxol 30mg', type: 'Tablet', strength: '30mg', manufacturer: 'Intas' },
    { name: 'Guaifenesin Syrup', type: 'Syrup', strength: '100mg/5ml', manufacturer: 'Alkem' },
    { name: 'Deriphyllin Retard 150mg', type: 'Tablet', strength: '150mg', manufacturer: 'Franco Indian' },
    { name: 'Levosalbutamol Nebuliser', type: 'Drops', strength: '1.25mg/ml', manufacturer: 'Cipla' },
    { name: 'Codeine Phosphate 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'Piramal' },

    // Cardiac / BP
    { name: 'Amlodipine 5mg', type: 'Tablet', strength: '5mg', manufacturer: 'Pfizer' },
    { name: 'Amlodipine 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'Pfizer' },
    { name: 'Telmisartan 40mg', type: 'Tablet', strength: '40mg', manufacturer: 'Glenmark' },
    { name: 'Losartan 50mg', type: 'Tablet', strength: '50mg', manufacturer: 'Torrent' },
    { name: 'Atenolol 50mg', type: 'Tablet', strength: '50mg', manufacturer: 'IPCA' },
    { name: 'Metoprolol 50mg', type: 'Tablet', strength: '50mg', manufacturer: 'AstraZeneca' },
    { name: 'Enalapril 5mg', type: 'Tablet', strength: '5mg', manufacturer: 'Cadila' },
    { name: 'Aspirin 75mg', type: 'Tablet', strength: '75mg', manufacturer: 'USV' },
    { name: 'Clopidogrel 75mg', type: 'Tablet', strength: '75mg', manufacturer: 'Sun Pharma' },
    { name: 'Atorvastatin 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'Pfizer' },
    { name: 'Atorvastatin 20mg', type: 'Tablet', strength: '20mg', manufacturer: 'Pfizer' },
    { name: 'Rosuvastatin 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'AstraZeneca' },

    // Diabetes
    { name: 'Metformin 500mg', type: 'Tablet', strength: '500mg', manufacturer: 'USV' },
    { name: 'Metformin 1000mg', type: 'Tablet', strength: '1000mg', manufacturer: 'USV' },
    { name: 'Glimepiride 1mg', type: 'Tablet', strength: '1mg', manufacturer: 'Sanofi' },
    { name: 'Glimepiride 2mg', type: 'Tablet', strength: '2mg', manufacturer: 'Sanofi' },
    { name: 'Sitagliptin 100mg', type: 'Tablet', strength: '100mg', manufacturer: 'MSD' },
    { name: 'Voglibose 0.3mg', type: 'Tablet', strength: '0.3mg', manufacturer: 'Torrent' },
    { name: 'Insulin Glargine', type: 'Injection', strength: '100IU/ml', manufacturer: 'Sanofi' },

    // Vitamins / Supplements
    { name: 'Vitamin D3 60000IU', type: 'Capsule', strength: '60000IU', manufacturer: 'USV' },
    { name: 'Vitamin B12 1500mcg', type: 'Tablet', strength: '1500mcg', manufacturer: 'Abbott' },
    { name: 'Calcium + Vitamin D3', type: 'Tablet', strength: '500+250IU', manufacturer: 'Abbott' },
    { name: 'Iron + Folic Acid', type: 'Tablet', strength: '100+0.5mg', manufacturer: 'GSK' },
    { name: 'Zinc 50mg', type: 'Tablet', strength: '50mg', manufacturer: 'Mankind' },
    { name: 'Multivitamin (Becosules)', type: 'Capsule', strength: 'Multi', manufacturer: 'Pfizer' },
    { name: 'Folic Acid 5mg', type: 'Tablet', strength: '5mg', manufacturer: 'Alkem' },
    { name: 'Omega-3 Fatty Acids', type: 'Capsule', strength: '1000mg', manufacturer: 'Sun Pharma' },

    // Steroids
    { name: 'Prednisolone 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'Cadila' },
    { name: 'Prednisolone 5mg', type: 'Tablet', strength: '5mg', manufacturer: 'Cadila' },
    { name: 'Methylprednisolone 8mg', type: 'Tablet', strength: '8mg', manufacturer: 'Pfizer' },
    { name: 'Dexamethasone 0.5mg', type: 'Tablet', strength: '0.5mg', manufacturer: 'Cadila' },
    { name: 'Hydrocortisone Cream', type: 'Cream', strength: '1%', manufacturer: 'GSK' },
    { name: 'Betamethasone Cream', type: 'Cream', strength: '0.05%', manufacturer: 'GSK' },

    // Topical
    { name: 'Diclofenac Gel', type: 'Gel', strength: '1%', manufacturer: 'Novartis' },
    { name: 'Mupirocin Ointment', type: 'Ointment', strength: '2%', manufacturer: 'GSK' },
    { name: 'Clotrimazole Cream', type: 'Cream', strength: '1%', manufacturer: 'Bayer' },
    { name: 'Silver Sulfadiazine Cream', type: 'Cream', strength: '1%', manufacturer: 'Dr. Reddys' },
    { name: 'Povidone Iodine Ointment', type: 'Ointment', strength: '5%', manufacturer: 'Win Medicare' },
    { name: 'Calamine Lotion', type: 'Cream', strength: '8%', manufacturer: 'Lacto Calamine' },

    // Eye / Ear
    { name: 'Ciprofloxacin Eye Drops', type: 'Drops', strength: '0.3%', manufacturer: 'Cipla' },
    { name: 'Tobramycin Eye Drops', type: 'Drops', strength: '0.3%', manufacturer: 'Alcon' },
    { name: 'Ofloxacin Eye Drops', type: 'Drops', strength: '0.3%', manufacturer: 'Cipla' },
    { name: 'Artificial Tears', type: 'Drops', strength: '0.5%', manufacturer: 'Alcon' },
    { name: 'Otosporin Ear Drops', type: 'Drops', strength: 'Multi', manufacturer: 'GSK' },

    // Antifungal
    { name: 'Fluconazole 150mg', type: 'Tablet', strength: '150mg', manufacturer: 'Pfizer' },
    { name: 'Itraconazole 100mg', type: 'Capsule', strength: '100mg', manufacturer: 'Glenmark' },
    { name: 'Terbinafine 250mg', type: 'Tablet', strength: '250mg', manufacturer: 'Dr. Reddys' },

    // Antacids / Laxatives
    { name: 'Gelusil MPS', type: 'Syrup', strength: '400mg/5ml', manufacturer: 'Pfizer' },
    { name: 'Digene Gel', type: 'Syrup', strength: '400mg/5ml', manufacturer: 'Abbott' },
    { name: 'Lactulose Syrup', type: 'Syrup', strength: '10g/15ml', manufacturer: 'Abbott' },
    { name: 'Isabgol (Psyllium Husk)', type: 'Powder', strength: '3.5g', manufacturer: 'Sat Isabgol' },

    // Muscle Relaxants
    { name: 'Thiocolchicoside 4mg', type: 'Capsule', strength: '4mg', manufacturer: 'Sanofi' },
    { name: 'Chlorzoxazone 500mg', type: 'Tablet', strength: '500mg', manufacturer: 'Intas' },
    { name: 'Tizanidine 2mg', type: 'Tablet', strength: '2mg', manufacturer: 'Sun Pharma' },

    // Anti-anxiety / CNS
    { name: 'Alprazolam 0.25mg', type: 'Tablet', strength: '0.25mg', manufacturer: 'Torrent' },
    { name: 'Escitalopram 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'Sun Pharma' },
    { name: 'Amitriptyline 10mg', type: 'Tablet', strength: '10mg', manufacturer: 'Intas' },

    // Thyroid
    { name: 'Levothyroxine 50mcg', type: 'Tablet', strength: '50mcg', manufacturer: 'Abbott' },
    { name: 'Levothyroxine 100mcg', type: 'Tablet', strength: '100mcg', manufacturer: 'Abbott' },
  ];

  for (const med of medicines) {
    await db.runAsync(
      `INSERT INTO medicines (id, name, type, strength, manufacturer, is_custom, usage_count) VALUES (?, ?, ?, ?, ?, 0, 0)`,
      [generateSeedId(), med.name, med.type, med.strength, med.manufacturer]
    );
  }
}

export async function seedLabTests(db: SQLite.SQLiteDatabase): Promise<void> {
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM lab_tests');
  if (count && count.c > 0) return;

  const labTests = [
    // Blood tests
    { name: 'Complete Blood Count (CBC)', category: 'Blood' },
    { name: 'Hemoglobin (Hb)', category: 'Blood' },
    { name: 'Erythrocyte Sedimentation Rate (ESR)', category: 'Blood' },
    { name: 'Peripheral Blood Smear', category: 'Blood' },
    { name: 'Platelet Count', category: 'Blood' },
    { name: 'Blood Group & Rh Typing', category: 'Blood' },
    { name: 'Prothrombin Time (PT/INR)', category: 'Blood' },
    { name: 'Reticulocyte Count', category: 'Blood' },

    // Diabetes
    { name: 'Fasting Blood Sugar (FBS)', category: 'Diabetes' },
    { name: 'Post Prandial Blood Sugar (PPBS)', category: 'Diabetes' },
    { name: 'Random Blood Sugar (RBS)', category: 'Diabetes' },
    { name: 'HbA1c (Glycated Hemoglobin)', category: 'Diabetes' },
    { name: 'Oral Glucose Tolerance Test (OGTT)', category: 'Diabetes' },
    { name: 'Fasting Insulin', category: 'Diabetes' },

    // Liver
    { name: 'Liver Function Test (LFT)', category: 'Liver' },
    { name: 'SGOT (AST)', category: 'Liver' },
    { name: 'SGPT (ALT)', category: 'Liver' },
    { name: 'Bilirubin (Total & Direct)', category: 'Liver' },
    { name: 'Alkaline Phosphatase', category: 'Liver' },
    { name: 'Gamma GT (GGT)', category: 'Liver' },
    { name: 'Serum Albumin', category: 'Liver' },
    { name: 'Hepatitis B Surface Antigen (HBsAg)', category: 'Liver' },
    { name: 'Hepatitis C Antibody (Anti-HCV)', category: 'Liver' },

    // Kidney
    { name: 'Kidney Function Test (KFT)', category: 'Kidney' },
    { name: 'Serum Creatinine', category: 'Kidney' },
    { name: 'Blood Urea Nitrogen (BUN)', category: 'Kidney' },
    { name: 'Serum Uric Acid', category: 'Kidney' },
    { name: 'eGFR', category: 'Kidney' },
    { name: 'Serum Electrolytes (Na/K/Cl)', category: 'Kidney' },
    { name: 'Serum Calcium', category: 'Kidney' },

    // Thyroid
    { name: 'Thyroid Profile (T3, T4, TSH)', category: 'Thyroid' },
    { name: 'TSH (Thyroid Stimulating Hormone)', category: 'Thyroid' },
    { name: 'Free T3', category: 'Thyroid' },
    { name: 'Free T4', category: 'Thyroid' },
    { name: 'Anti-TPO Antibodies', category: 'Thyroid' },

    // Lipid
    { name: 'Lipid Profile', category: 'Lipid' },
    { name: 'Total Cholesterol', category: 'Lipid' },
    { name: 'HDL Cholesterol', category: 'Lipid' },
    { name: 'LDL Cholesterol', category: 'Lipid' },
    { name: 'Triglycerides', category: 'Lipid' },
    { name: 'VLDL Cholesterol', category: 'Lipid' },

    // Urine
    { name: 'Urine Routine & Microscopy', category: 'Urine' },
    { name: 'Urine Culture & Sensitivity', category: 'Urine' },
    { name: '24-Hour Urine Protein', category: 'Urine' },
    { name: 'Urine Microalbumin', category: 'Urine' },
    { name: 'Urine Pregnancy Test (UPT)', category: 'Urine' },

    // Cardiac
    { name: 'ECG (Electrocardiogram)', category: 'Cardiac' },
    { name: '2D Echocardiography', category: 'Cardiac' },
    { name: 'Troponin I', category: 'Cardiac' },
    { name: 'CK-MB', category: 'Cardiac' },
    { name: 'BNP / NT-proBNP', category: 'Cardiac' },
    { name: 'Treadmill Test (TMT)', category: 'Cardiac' },

    // Infection
    { name: 'C-Reactive Protein (CRP)', category: 'Infection' },
    { name: 'Widal Test', category: 'Infection' },
    { name: 'Dengue NS1 Antigen', category: 'Infection' },
    { name: 'Dengue IgG/IgM', category: 'Infection' },
    { name: 'Malaria Antigen (Rapid)', category: 'Infection' },
    { name: 'Blood Culture & Sensitivity', category: 'Infection' },
    { name: 'HIV 1 & 2 Antibody', category: 'Infection' },
    { name: 'VDRL / RPR', category: 'Infection' },
    { name: 'Mantoux Test (TB Skin Test)', category: 'Infection' },
    { name: 'COVID-19 RT-PCR', category: 'Infection' },
    { name: 'COVID-19 Rapid Antigen', category: 'Infection' },

    // Imaging
    { name: 'X-Ray Chest PA View', category: 'Imaging' },
    { name: 'X-Ray (Specify Part)', category: 'Imaging' },
    { name: 'Ultrasound Abdomen', category: 'Imaging' },
    { name: 'Ultrasound Pelvis', category: 'Imaging' },
    { name: 'CT Scan (Specify Region)', category: 'Imaging' },
    { name: 'MRI (Specify Region)', category: 'Imaging' },

    // Other
    { name: 'Vitamin D (25-Hydroxy)', category: 'Other' },
    { name: 'Vitamin B12', category: 'Other' },
    { name: 'Serum Iron & TIBC', category: 'Other' },
    { name: 'Serum Ferritin', category: 'Other' },
    { name: 'RA Factor', category: 'Other' },
    { name: 'ANA (Antinuclear Antibody)', category: 'Other' },
    { name: 'PSA (Prostate Specific Antigen)', category: 'Other' },
    { name: 'Semen Analysis', category: 'Other' },
    { name: 'Stool Routine & Microscopy', category: 'Other' },
    { name: 'Pap Smear', category: 'Other' },
  ];

  for (const test of labTests) {
    await db.runAsync(
      `INSERT INTO lab_tests (id, name, category, is_custom, usage_count) VALUES (?, ?, ?, 0, 0)`,
      [generateSeedId(), test.name, test.category]
    );
  }
}
