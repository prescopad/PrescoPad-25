import * as Print from 'expo-print';
import { File, Directory, Paths } from 'expo-file-system';
import { Prescription } from '../types/prescription.types';
import { Clinic, DoctorProfile } from '../types/clinic.types';

export async function generatePrescriptionPDF(
  prescription: Prescription,
  clinic: Clinic | null,
  doctor: DoctorProfile | null
): Promise<string> {
  const html = buildPrescriptionHTML(prescription, clinic, doctor);
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

  // Move to permanent location
  const fileName = `${prescription.id}_${Date.now()}.pdf`;
  const prescriptionsDir = new Directory(Paths.document, 'prescriptions');

  // Ensure directory exists
  if (!prescriptionsDir.exists) {
    prescriptionsDir.create({ intermediates: true });
  }

  const destFile = new File(prescriptionsDir, fileName);
  const sourceFile = new File(uri);
  sourceFile.move(destFile);
  return destFile.uri;
}

function buildPrescriptionHTML(
  rx: Prescription,
  clinic: Clinic | null,
  doctor: DoctorProfile | null
): string {
  const clinicName = clinic?.name || 'PrescoPad Clinic';
  const clinicAddress = clinic?.address || '';
  const clinicPhone = clinic?.phone || '';
  const clinicEmail = clinic?.email || '';
  const doctorName = doctor?.name || 'Doctor';
  const doctorSpecialty = doctor?.specialty || '';
  const doctorReg = doctor?.regNumber || '';
  const dateStr = new Date(rx.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const medicineRows = rx.medicines
    .map(
      (m, i) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#334155;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">
          <strong style="color:#0F172A;">${m.medicineName}</strong>
          <span style="color:#64748B;font-size:11px;"> (${m.type})</span>
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#334155;">${m.frequency}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#334155;">${m.duration}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#64748B;font-size:11px;">${m.timing}${m.notes ? ` - ${m.notes}` : ''}</td>
      </tr>`
    )
    .join('');

  const labTestsList = rx.labTests
    .map((t) => `<li style="margin-bottom:4px;color:#334155;">${t.testName}${t.notes ? ` - <em>${t.notes}</em>` : ''}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0F172A; padding: 24px; background: #fff; }
    .header { text-align: center; border-bottom: 3px solid #0077B6; padding-bottom: 16px; margin-bottom: 16px; }
    .clinic-name { font-size: 22px; font-weight: 700; color: #0077B6; letter-spacing: 0.5px; }
    .clinic-info { font-size: 11px; color: #64748B; margin-top: 4px; }
    .doctor-info { font-size: 12px; color: #334155; margin-top: 6px; }
    .rx-symbol { font-size: 28px; font-weight: 700; color: #0077B6; font-style: italic; }
    .patient-section { display: flex; justify-content: space-between; margin: 12px 0; padding: 10px; background: #F8FAFC; border-radius: 6px; }
    .patient-field { font-size: 12px; }
    .patient-label { color: #64748B; font-size: 10px; text-transform: uppercase; }
    .patient-value { color: #0F172A; font-weight: 600; }
    .section-title { font-size: 13px; font-weight: 700; color: #0077B6; margin: 14px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #0077B6; color: #fff; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
    .diagnosis-box { background: #F0F9FF; border-left: 3px solid #0077B6; padding: 10px; margin: 8px 0; border-radius: 0 6px 6px 0; }
    .advice-box { background: #FEF3C7; border-left: 3px solid #D97706; padding: 10px; margin: 8px 0; border-radius: 0 6px 6px 0; font-size: 12px; }
    .follow-up { font-size: 12px; color: #DC2626; font-weight: 600; margin-top: 8px; }
    .signature-section { margin-top: 30px; text-align: right; }
    .signature-img { max-height: 50px; }
    .signature-line { border-top: 1px solid #334155; width: 200px; margin-left: auto; padding-top: 4px; }
    .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 9px; color: #94A3B8; }
    .hash { font-family: monospace; font-size: 8px; color: #94A3B8; word-break: break-all; }
  </style>
</head>
<body>
  <div class="header">
    <div class="clinic-name">${clinicName}</div>
    ${clinicAddress ? `<div class="clinic-info">${clinicAddress}</div>` : ''}
    ${clinicPhone || clinicEmail ? `<div class="clinic-info">${[clinicPhone, clinicEmail].filter(Boolean).join(' | ')}</div>` : ''}
    <div class="doctor-info">
      <strong>Dr. ${doctorName}</strong>${doctorSpecialty ? ` | ${doctorSpecialty}` : ''}${doctorReg ? ` | Reg: ${doctorReg}` : ''}
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <span class="rx-symbol">Rx</span>
    <span style="font-size:12px;color:#64748B;">Date: <strong style="color:#0F172A;">${dateStr}</strong> | ID: <strong style="color:#0077B6;">${rx.id}</strong></span>
  </div>

  <div class="patient-section">
    <div class="patient-field">
      <div class="patient-label">Patient</div>
      <div class="patient-value">${rx.patientName}</div>
    </div>
    <div class="patient-field">
      <div class="patient-label">Age/Gender</div>
      <div class="patient-value">${rx.patientAge} yrs / ${rx.patientGender}</div>
    </div>
    <div class="patient-field">
      <div class="patient-label">Phone</div>
      <div class="patient-value">${rx.patientPhone || 'N/A'}</div>
    </div>
  </div>

  ${rx.diagnosis ? `
  <div class="section-title">Diagnosis</div>
  <div class="diagnosis-box">${rx.diagnosis}</div>
  ` : ''}

  ${rx.labTests.length > 0 ? `
  <div class="section-title">Lab Tests / Investigations</div>
  <ul style="padding-left:20px;font-size:12px;">${labTestsList}</ul>
  ` : ''}

  ${rx.medicines.length > 0 ? `
  <div class="section-title">Medicines</div>
  <table>
    <thead>
      <tr>
        <th style="width:30px;">#</th>
        <th>Medicine</th>
        <th>Dosage</th>
        <th>Duration</th>
        <th>Instructions</th>
      </tr>
    </thead>
    <tbody>${medicineRows}</tbody>
  </table>
  ` : ''}

  ${rx.advice ? `
  <div class="section-title">Advice</div>
  <div class="advice-box">${rx.advice}</div>
  ` : ''}

  ${rx.followUpDate ? `
  <div class="follow-up">Follow-up: ${new Date(rx.followUpDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
  ` : ''}

  <div class="signature-section">
    ${rx.signature ? `<img src="${rx.signature}" class="signature-img" />` : ''}
    <div class="signature-line">
      <div style="font-size:12px;font-weight:600;">Dr. ${doctorName}</div>
      ${doctorReg ? `<div style="font-size:10px;color:#64748B;">Reg. No: ${doctorReg}</div>` : ''}
    </div>
  </div>

  <div class="footer">
    <div>Generated by PrescoPad - Digital Prescription System</div>
    ${rx.pdfHash ? `<div class="hash">Verification Hash: ${rx.pdfHash}</div>` : ''}
  </div>
</body>
</html>`;
}

export function buildShareText(
  rx: Prescription,
  doctor: DoctorProfile | null
): string {
  const dateStr = new Date(rx.createdAt).toLocaleDateString('en-IN');
  let text = `*Prescription - ${rx.id}*\n`;
  text += `Date: ${dateStr}\n`;
  text += `Doctor: Dr. ${doctor?.name || 'Doctor'}\n\n`;
  text += `*Patient:* ${rx.patientName} (${rx.patientAge}/${rx.patientGender})\n\n`;

  if (rx.diagnosis) {
    text += `*Diagnosis:* ${rx.diagnosis}\n\n`;
  }

  if (rx.medicines.length > 0) {
    text += `*Medicines:*\n`;
    rx.medicines.forEach((m, i) => {
      text += `${i + 1}. ${m.medicineName} (${m.type})\n`;
      text += `   ${m.frequency} | ${m.duration} | ${m.timing}\n`;
    });
    text += '\n';
  }

  if (rx.labTests.length > 0) {
    text += `*Lab Tests:*\n`;
    rx.labTests.forEach((t, i) => {
      text += `${i + 1}. ${t.testName}\n`;
    });
    text += '\n';
  }

  if (rx.advice) {
    text += `*Advice:* ${rx.advice}\n\n`;
  }

  if (rx.followUpDate) {
    text += `*Follow-up:* ${new Date(rx.followUpDate).toLocaleDateString('en-IN')}\n\n`;
  }

  text += `_Generated by PrescoPad_`;
  return text;
}
