'use client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MSESession, Patient, MSEAssessment, RiskAssessment, FACSAssessment, ProsodyAssessment, CognitiveAssessment } from '@/types'

// ── Colour Palette ─────────────────────────────────────────
const NAVY   = [10, 22, 40] as const   // #0A1628
const TEAL   = [11, 110, 79] as const  // #0B6E4F
const WHITE  = [255, 255, 255] as const
const CREAM  = [248, 244, 236] as const
const GRAY   = [120, 130, 145] as const
const RED    = [185, 28, 28] as const
const AMBER  = [217, 119, 6] as const

type PDFColor = [number, number, number]
const toCol = (arr: readonly [number, number, number]): PDFColor => [...arr]

// ── Helpers ────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function severityColor(s: string): readonly [number, number, number] {
  switch (s?.toLowerCase()) {
    case 'severe':   return RED
    case 'moderate': return AMBER
    case 'mild':     return [146, 64, 14]
    default:         return [5, 150, 105]
  }
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : ''
}

// ── Main Generator ─────────────────────────────────────────
export function generateClinicalPDF(session: MSESession, patient: Patient | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  let y = 0

  // ── HEADER BAR ───────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 38, 'F')

  // Teal accent line
  doc.setFillColor(...TEAL)
  doc.rect(0, 38, W, 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...WHITE)
  doc.text('AI-MSE Clinical Report', 15, 16)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 200, 220)
  doc.text('Intelligent Mental Status Examination  •  Multimodal Analysis', 15, 23)
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 15, 29)

  // Confidential badge
  doc.setFillColor(185, 28, 28)
  doc.roundedRect(W - 55, 10, 42, 8, 2, 2, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('CONFIDENTIAL', W - 52, 15.5)

  y = 48

  // ── 1. PATIENT INFORMATION ───────────────────────────────
  doc.setFillColor(...CREAM)
  doc.roundedRect(12, y, W - 24, 36, 3, 3, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('1. PATIENT INFORMATION', 18, y + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)

  const patientName = patient?.full_name || 'Unknown'
  const patientAge = patient?.age || 'N/A'
  const patientGender = capitalize(patient?.gender || 'N/A')
  const ehrId = patient?.ehr_id || 'LOCAL-' + session.id.substring(0, 6)
  const complaint = patient?.presenting_complaint || 'Not specified'

  doc.text(`Name: ${patientName}`, 18, y + 16)
  doc.text(`Age: ${patientAge}   |   Gender: ${patientGender}`, 18, y + 22)
  doc.text(`EHR ID: ${ehrId}`, 18, y + 28)
  doc.text(`Chief Complaint: ${complaint.substring(0, 80)}`, W / 2 - 10, y + 16)
  doc.text(`Session Date: ${formatDate(session.created_at)}`, W / 2 - 10, y + 22)
  doc.text(`Duration: ${session.audio_duration_seconds || 0}s`, W / 2 - 10, y + 28)

  y += 42

  // ── 2. OVERALL SEVERITY ──────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('2. OVERALL SEVERITY & RISK', 18, y + 6)

  // Severity score box
  const sev = session.overall_severity || 0
  const sevCol: [number, number, number] = sev > 70 ? [...RED] : sev > 40 ? [...AMBER] : [...TEAL]
  doc.setFillColor(...sevCol)
  doc.roundedRect(18, y + 10, 30, 16, 3, 3, 'F')
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text(`${sev}%`, 25, y + 21)

  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'normal')
  doc.text(`Overall Pathology Score: ${sev}/100`, 54, y + 15)

  const ra = session.risk_assessment
  if (ra) {
    doc.text(`Suicide Risk: ${capitalize(ra.suicide_risk || 'none')}   |   Violence Risk: ${capitalize(ra.violence_risk || 'none')}`, 54, y + 21)
    doc.text(`Psychosis Probability: ${((ra.psychosis_probability || 0) * 100).toFixed(0)}%   |   Immediate Action: ${ra.requires_immediate_action ? 'YES' : 'No'}`, 54, y + 27)
  }

  y += 34

  // ── 3. MSE DOMAIN SCORES TABLE ───────────────────────────
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('3. MENTAL STATUS EXAMINATION DOMAINS', 18, y)
  y += 4

  const assessment = session.assessment
  if (assessment) {
    const domainKeys = [
      'appearance', 'behavior', 'speech', 'mood', 'affect',
      'thought_process', 'thought_content', 'perception', 'cognition', 'insight_judgment'
    ] as const

    const tableData = domainKeys.map(key => {
      const domain = (assessment as any)[key]
      if (!domain) return [capitalize(key), '0', 'Normal', 'No data']
      return [
        capitalize(key),
        `${domain.score || 0}`,
        capitalize(domain.severity || 'normal'),
        (Array.isArray(domain.observations) ? domain.observations : []).join('; ').substring(0, 80) || '—'
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['Domain', 'Score', 'Severity', 'Key Observations']],
      body: tableData,
      margin: { left: 14, right: 14 },
      headStyles: {
        fillColor: toCol(NAVY),
        textColor: toCol(WHITE),
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 7.5, textColor: toCol(NAVY), cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [245, 243, 238] },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 'auto' },
      },
      didParseCell: (data: any) => {
        if (data.column.index === 2 && data.section === 'body') {
          const sev = data.cell.raw?.toString().toLowerCase()
          if (sev === 'severe') data.cell.styles.textColor = [185, 28, 28]
          else if (sev === 'moderate') data.cell.styles.textColor = [217, 119, 6]
          else if (sev === 'mild') data.cell.styles.textColor = [146, 64, 14]
          else data.cell.styles.textColor = [5, 150, 105]
        }
      }
    })

    y = (doc as any).lastAutoTable.finalY + 6
  }

  // ── 4. CLINICAL SUMMARY ──────────────────────────────────
  if (y > H - 60) { doc.addPage(); y = 20 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('4. CLINICAL SUMMARY & DIAGNOSTIC IMPRESSION', 18, y)
  y += 6

  doc.setFillColor(...CREAM)
  const summaryText = session.clinical_summary || 'No clinical summary available.'
  const splitSummary = doc.splitTextToSize(summaryText, W - 40)
  const summaryHeight = splitSummary.length * 4.5 + 8
  doc.roundedRect(14, y, W - 28, summaryHeight, 2, 2, 'F')

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(splitSummary, 20, y + 6)
  y += summaryHeight + 4

  if (session.diagnostic_impression) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...NAVY)
    doc.text('Diagnostic Impression:', 18, y)
    doc.setFont('helvetica', 'normal')
    const diagText = doc.splitTextToSize(session.diagnostic_impression, W - 40)
    doc.text(diagText, 18, y + 5)
    y += diagText.length * 4 + 8
  }

  // ── 5. FACIAL AFFECT & EMOTION ANALYSIS ──────────────────
  if (y > H - 50) { doc.addPage(); y = 20 }

  const facs = session.facs_data as FACSAssessment | undefined
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('5. FACIAL AFFECT & EMOTION ANALYSIS (FACS)', 18, y)
  y += 6

  if (facs && facs.frames_analysed > 0) {
    const facsTableData = [
      ['Frames Analysed', `${facs.frames_analysed}`],
      ['Dominant Emotion', capitalize(facs.dominant_emotion || 'neutral')],
      ['Affect Range', capitalize(facs.affect_range || 'not assessed')],
      ['Affect Range Score', `${(facs.affect_range_score || 0).toFixed(1)}`],
      ['Congruence Score', `${(facs.congruence_score || 0).toFixed(1)}`],
      ['Severity', capitalize(facs.severity || 'normal')],
      ['Score', `${facs.score || 0}/100`],
    ]

    autoTable(doc, {
      startY: y,
      body: facsTableData,
      margin: { left: 14, right: W / 2 + 10 },
      theme: 'plain',
      bodyStyles: { fontSize: 8, textColor: toCol(NAVY), cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { cellWidth: 35 },
      },
    })

    // Observations on right side
    const obsY = y
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...NAVY)
    doc.text('Observations:', W / 2 + 5, obsY + 3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    const facsObs = Array.isArray(facs.observations) ? facs.observations : []
    facsObs.forEach((obs, i) => {
      doc.text(`• ${obs.substring(0, 60)}`, W / 2 + 5, obsY + 9 + i * 4)
    })

    const facsFlags = Array.isArray(facs.flags) ? facs.flags : []
    if (facsFlags.length > 0) {
      doc.setTextColor(...RED)
      doc.setFont('helvetica', 'bold')
      doc.text('Flags:', W / 2 + 5, obsY + 9 + facsObs.length * 4 + 2)
      doc.setFont('helvetica', 'normal')
      facsFlags.forEach((flag, i) => {
        doc.text(`⚠ ${flag}`, W / 2 + 5, obsY + 15 + facsObs.length * 4 + i * 4)
      })
    }

    y = (doc as any).lastAutoTable.finalY + 6
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('No facial affect data recorded in this session.', 18, y + 2)
    y += 10
  }

  // ── 6. ACOUSTIC & PROSODY ANALYSIS ───────────────────────
  if (y > H - 50) { doc.addPage(); y = 20 }

  const prosody = session.prosody_data as ProsodyAssessment | undefined
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('6. ACOUSTIC & PROSODY ANALYSIS', 18, y)
  y += 6

  if (prosody) {
    const prosodyData = [
      ['Speech Rate', `${prosody.speech_rate_wpm || 0} WPM (${capitalize(prosody.speech_rate_category || 'unknown')})`],
      ['Pause Frequency', `${prosody.pause_frequency || 0} pauses/min`],
      ['Mean Pause Duration', `${prosody.pause_mean_duration_ms || 0} ms`],
      ['Pitch Mean', `${prosody.pitch_mean_hz || 0} Hz`],
      ['Pitch Variance', `${(prosody.pitch_variance || 0).toFixed(2)}`],
      ['Energy (Mean / Var)', `${(prosody.energy_mean || 0).toFixed(4)} / ${(prosody.energy_variance || 0).toFixed(4)}`],
      ['First Response Latency', `${prosody.latency_first_response_ms || 0} ms`],
      ['Prosody Score', `${prosody.prosody_score || 0}/100`],
      ['Severity', capitalize(prosody.severity || 'normal')],
    ]

    autoTable(doc, {
      startY: y,
      body: prosodyData,
      margin: { left: 14, right: 14 },
      theme: 'striped',
      bodyStyles: { fontSize: 8, textColor: toCol(NAVY), cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [245, 243, 238] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
      },
    })

    y = (doc as any).lastAutoTable.finalY + 4

    const prosodyObs = Array.isArray(prosody.observations) ? prosody.observations : []
    if (prosodyObs.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...NAVY)
      doc.text('Acoustic Observations:', 18, y)
      doc.setFont('helvetica', 'normal')
      prosodyObs.forEach((obs, i) => {
        doc.text(`• ${obs}`, 22, y + 5 + i * 4)
      })
      y += 5 + prosodyObs.length * 4 + 4
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('No acoustic prosody data recorded in this session.', 18, y + 2)
    y += 10
  }

  // ── 7. COGNITIVE SCREENING ───────────────────────────────
  if (y > H - 50) { doc.addPage(); y = 20 }

  const cog = session.cognitive_data as CognitiveAssessment | undefined
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('7. COGNITIVE SCREENING RESULTS', 18, y)
  y += 6

  if (cog) {
    const cogData = [
      ['Digit Span', `Max Span: ${cog.digit_span?.max_span || 0}  |  Score: ${cog.digit_span?.score || 0}/100  |  ${capitalize(cog.digit_span?.severity || 'normal')}`],
      ['Trail Making', `Time: ${cog.trail_making?.completion_time_ms ? (cog.trail_making.completion_time_ms / 1000).toFixed(1) + 's' : 'N/A'}  |  Errors: ${cog.trail_making?.error_count || 0}  |  ${capitalize(cog.trail_making?.severity || 'normal')}`],
      ['Word Recall', `Recalled: ${cog.word_recall?.words_recalled?.length || 0}/${cog.word_recall?.words_presented?.length || 0}  |  Score: ${cog.word_recall?.score || 0}/100  |  ${capitalize(cog.word_recall?.severity || 'normal')}`],
      ['Composite', `${cog.composite_score || 0}/100  (${capitalize(cog.severity || 'normal')})`],
    ]

    autoTable(doc, {
      startY: y,
      body: cogData,
      margin: { left: 14, right: 14 },
      theme: 'striped',
      bodyStyles: { fontSize: 8, textColor: toCol(NAVY), cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [245, 243, 238] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('No cognitive screening data available.', 18, y + 2)
    y += 10
  }

  // ── 8. RISK ASSESSMENT & RECOMMENDATIONS ─────────────────
  if (y > H - 50) { doc.addPage(); y = 20 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('8. RISK ASSESSMENT & RECOMMENDED ACTIONS', 18, y)
  y += 6

  if (ra) {
    const actions = Array.isArray(ra.recommended_actions) ? ra.recommended_actions : []
    if (actions.length > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...NAVY)
      actions.forEach((action, i) => {
        const bullet = doc.splitTextToSize(`${i + 1}. ${action}`, W - 40)
        doc.text(bullet, 22, y + i * 5)
        y += bullet.length * 4
      })
      y += 4
    }

    const riskFactors = [
      ...(Array.isArray(ra.suicide_risk_factors) ? ra.suicide_risk_factors.map(f => `[Suicide] ${f}`) : []),
      ...(Array.isArray(ra.violence_risk_factors) ? ra.violence_risk_factors.map(f => `[Violence] ${f}`) : []),
    ]
    if (riskFactors.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...RED)
      doc.text('Risk Factors:', 18, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...NAVY)
      riskFactors.forEach((factor, i) => {
        doc.text(`• ${factor.substring(0, 80)}`, 22, y + 5 + i * 4)
      })
      y += 5 + riskFactors.length * 4 + 4
    }
  }

  // ── 9. TRANSCRIPT ────────────────────────────────────────
  if (y > H - 40) { doc.addPage(); y = 20 }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('9. SESSION TRANSCRIPT (Whisper ASR)', 18, y)
  y += 6

  const transcript = session.transcript || 'No transcript available.'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)

  const splitTranscript = doc.splitTextToSize(transcript, W - 36)
  splitTranscript.forEach((line: string) => {
    if (y > H - 20) { doc.addPage(); y = 20 }
    doc.text(line, 18, y)
    y += 4
  })

  y += 6

  // ── 10. INTERVENTION PLAN ────────────────────────────────
  if (y > H - 40) { doc.addPage(); y = 20 }

  const plan = session.intervention_plan
  if (plan) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...TEAL)
    doc.text('10. INTERVENTION PLAN & FOLLOW-UP', 18, y)
    y += 6

    const planSections = [
      { title: 'Pharmacological', items: plan.pharmacological },
      { title: 'Psychotherapeutic', items: plan.psychotherapeutic },
      { title: 'Lifestyle', items: plan.lifestyle_recommendations },
    ]

    planSections.forEach(sec => {
      const items = Array.isArray(sec.items) ? sec.items : []
      if (items.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(`${sec.title}:`, 18, y)
        doc.setFont('helvetica', 'normal')
        items.forEach((item, i) => {
          if (y > H - 15) { doc.addPage(); y = 20 }
          doc.text(`• ${item}`, 24, y + 5 + i * 4)
        })
        y += 5 + items.length * 4 + 2
      }
    })

    if (plan.crisis_plan) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...RED)
      doc.text('Crisis Plan:', 18, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...NAVY)
      const crisisLines = doc.splitTextToSize(plan.crisis_plan, W - 40)
      doc.text(crisisLines, 24, y + 5)
      y += 5 + crisisLines.length * 4 + 2
    }

    if (plan.next_follow_up) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEAL)
      doc.text(`Next Follow-Up: ${plan.next_follow_up}`, 18, y + 2)
      y += 8
    }
  }

  // ── FOOTER ───────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    // Bottom bar
    doc.setFillColor(...NAVY)
    doc.rect(0, H - 12, W, 12, 'F')
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 175, 195)
    doc.text('AI-MSE  •  Confidential Clinical Document  •  Not for distribution without authorisation', W / 2, H - 5, { align: 'center' })
    doc.text(`Page ${i} of ${pageCount}`, W - 16, H - 5)
  }

  return doc
}

export function downloadPDF(session: MSESession, patient: Patient | null) {
  const doc = generateClinicalPDF(session, patient)
  const patientName = patient?.full_name?.replace(/\s+/g, '_') || 'Unknown'
  const date = new Date(session.created_at).toISOString().split('T')[0]
  doc.save(`AI-MSE_Report_${patientName}_${date}.pdf`)
}
