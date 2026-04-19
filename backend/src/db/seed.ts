import { pool } from '../config/database';

async function seed(): Promise<void> {
  console.log('Seeding sample data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Doctor user ──
    const doctorRes = await client.query(`
      INSERT INTO users (id, phone, role, name, specialty, reg_number, is_profile_complete, doctor_code)
      VALUES (
        uuid_generate_v4(), '9876543210', 'doctor', 'Dr. Rajesh Kumar',
        'General Physician', 'MCI-2024-45678', true, generate_doctor_code()
      )
      RETURNING id, doctor_code
    `);
    const doctorId = doctorRes.rows[0].id;
    const doctorCode = doctorRes.rows[0].doctor_code;
    console.log(`Doctor created: Dr. Rajesh Kumar (code: ${doctorCode})`);

    // ── Clinic ──
    const clinicRes = await client.query(`
      INSERT INTO clinics (id, name, address, phone, owner_id)
      VALUES (
        uuid_generate_v4(), 'Kumar Health Clinic',
        '42 MG Road, Pune, Maharashtra 411001', '9876543210', $1
      )
      RETURNING id
    `, [doctorId]);
    const clinicId = clinicRes.rows[0].id;

    // Link doctor to clinic
    await client.query(`UPDATE users SET clinic_id = $1 WHERE id = $2`, [clinicId, doctorId]);
    console.log(`Clinic created: Kumar Health Clinic`);

    // ── Assistant user ──
    const assistantRes = await client.query(`
      INSERT INTO users (id, phone, role, name, is_profile_complete, clinic_id)
      VALUES (
        uuid_generate_v4(), '9123456789', 'assistant', 'Priya Sharma', true, $1
      )
      RETURNING id
    `, [clinicId]);
    const assistantId = assistantRes.rows[0].id;
    console.log(`Assistant created: Priya Sharma`);

    // ── Accepted connection request ──
    await client.query(`
      INSERT INTO connection_requests (clinic_id, doctor_id, assistant_id, initiated_by, status)
      VALUES ($1, $2, $3, 'assistant', 'accepted')
    `, [clinicId, doctorId, assistantId]);

    // ── Doctor wallet with balance ──
    const walletRes = await client.query(`
      INSERT INTO wallets (user_id, balance)
      VALUES ($1, 250.00)
      RETURNING id
    `, [doctorId]);
    const walletId = walletRes.rows[0].id;

    // ── Wallet transactions ──
    await client.query(`
      INSERT INTO transactions (wallet_id, type, amount, description) VALUES
        ($1, 'credit', 500.00, 'Welcome bonus'),
        ($1, 'debit', 5.00, 'Prescription #RX-240101'),
        ($1, 'debit', 5.00, 'Prescription #RX-240102'),
        ($1, 'credit', 100.00, 'Wallet top-up'),
        ($1, 'debit', 5.00, 'Prescription #RX-240103')
    `, [walletId]);
    console.log(`Wallet seeded: ₹250.00`);

    // ── Patients ──
    const patientNames = [
      { name: 'Amit Patel', age: 35, gender: 'male', phone: '9988776655', blood_group: 'B+', weight: 72 },
      { name: 'Sunita Devi', age: 45, gender: 'female', phone: '9877665544', blood_group: 'O+', weight: 58 },
      { name: 'Rahul Verma', age: 28, gender: 'male', phone: '9766554433', blood_group: 'A+', weight: 68 },
      { name: 'Meena Kumari', age: 52, gender: 'female', phone: '9655443322', blood_group: 'AB+', weight: 65 },
      { name: 'Vikram Singh', age: 60, gender: 'male', phone: '9544332211', blood_group: 'O-', weight: 80 },
      { name: 'Anita Rao', age: 30, gender: 'female', phone: '9433221100', blood_group: 'A-', weight: 55 },
      { name: 'Deepak Joshi', age: 42, gender: 'male', phone: '9322110099', blood_group: 'B-', weight: 75 },
      { name: 'Kavita Nair', age: 38, gender: 'female', phone: '9211009988', blood_group: 'O+', weight: 62 },
    ];

    const patientIds: string[] = [];
    for (const p of patientNames) {
      const res = await client.query(`
        INSERT INTO patients (clinic_id, name, age, gender, phone, blood_group, weight)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [clinicId, p.name, p.age, p.gender, p.phone, p.blood_group, p.weight]);
      patientIds.push(res.rows[0].id);
    }
    console.log(`${patientIds.length} patients created`);

    // ── Queue (today's patients) ──
    await client.query(`
      INSERT INTO queue (clinic_id, patient_id, status, added_by, token_number, notes) VALUES
        ($1, $2, 'waiting', $5, 1, 'Fever and cold since 2 days'),
        ($1, $3, 'waiting', $5, 2, 'Routine checkup'),
        ($1, $4, 'waiting', $5, 3, 'Knee pain')
    `, [clinicId, patientIds[0], patientIds[1], patientIds[2], assistantId]);
    console.log(`3 patients added to queue`);

    // ── Prescription (completed) ──
    const rxId = 'RX-240101';
    await client.query(`
      INSERT INTO prescriptions (id, clinic_id, patient_id, patient_name, patient_age, patient_gender, patient_phone, doctor_id, diagnosis, advice, follow_up_date, status, wallet_deducted)
      VALUES ($1, $2, $3, 'Vikram Singh', 60, 'male', '9544332211', $4, 'Hypertension Grade 1', 'Low salt diet, regular exercise, monitor BP daily', '2024-02-15', 'finalized', 1)
    `, [rxId, clinicId, patientIds[4], doctorId]);

    await client.query(`
      INSERT INTO prescription_medicines (clinic_id, prescription_id, medicine_name, type, dosage, frequency, duration, timing) VALUES
        ($1, $2, 'Amlodipine', 'Tablet', '5mg', 'Once daily', '30 days', 'Morning'),
        ($1, $2, 'Telmisartan', 'Tablet', '40mg', 'Once daily', '30 days', 'Night')
    `, [clinicId, rxId]);

    await client.query(`
      INSERT INTO prescription_lab_tests (clinic_id, prescription_id, test_name, category) VALUES
        ($1, $2, 'Lipid Profile', 'Biochemistry'),
        ($1, $2, 'Serum Creatinine', 'Renal')
    `, [clinicId, rxId]);
    console.log(`1 prescription created: ${rxId}`);

    // ── Second prescription ──
    const rxId2 = 'RX-240102';
    await client.query(`
      INSERT INTO prescriptions (id, clinic_id, patient_id, patient_name, patient_age, patient_gender, patient_phone, doctor_id, diagnosis, advice, status, wallet_deducted)
      VALUES ($1, $2, $3, 'Sunita Devi', 45, 'female', '9877665544', $4, 'Acute Pharyngitis', 'Warm saline gargles, adequate rest', 'finalized', 1)
    `, [rxId2, clinicId, patientIds[1], doctorId]);

    await client.query(`
      INSERT INTO prescription_medicines (clinic_id, prescription_id, medicine_name, type, dosage, frequency, duration, timing) VALUES
        ($1, $2, 'Amoxicillin', 'Capsule', '500mg', 'Three times daily', '5 days', 'After food'),
        ($1, $2, 'Paracetamol', 'Tablet', '650mg', 'As needed', '3 days', 'After food'),
        ($1, $2, 'Chlorhexidine Gargle', 'Liquid', '15ml', 'Twice daily', '5 days', 'After food')
    `, [clinicId, rxId2]);
    console.log(`1 prescription created: ${rxId2}`);

    // ── Custom medicines ──
    await client.query(`
      INSERT INTO custom_medicines (clinic_id, name, type, strength, usage_count) VALUES
        ($1, 'Metformin SR', 'Tablet', '500mg', 12),
        ($1, 'Pantoprazole', 'Tablet', '40mg', 8),
        ($1, 'Cetirizine', 'Tablet', '10mg', 15),
        ($1, 'Azithromycin', 'Tablet', '500mg', 6)
    `, [clinicId]);

    // ── Custom lab tests ──
    await client.query(`
      INSERT INTO custom_lab_tests (clinic_id, name, category, usage_count) VALUES
        ($1, 'HbA1c', 'Biochemistry', 10),
        ($1, 'Thyroid Profile', 'Endocrine', 7),
        ($1, 'CBC with ESR', 'Hematology', 14)
    `, [clinicId]);
    console.log(`4 custom medicines + 3 custom lab tests added`);

    await client.query('COMMIT');

    console.log('\n✅ Sample data seeded successfully!');
    console.log(`\n  Doctor Login:    9876543210 (Dr. Rajesh Kumar)`);
    console.log(`  Doctor Code:     ${doctorCode}`);
    console.log(`  Assistant Login:  9123456789 (Priya Sharma)`);
    console.log(`  Clinic:          Kumar Health Clinic`);
    console.log(`  Patients:        ${patientIds.length}`);
    console.log(`  Queue:           3 waiting`);
    console.log(`  Prescriptions:   2 finalized`);
    console.log(`  Wallet:          ₹250.00\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
