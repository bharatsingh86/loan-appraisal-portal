const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType
} = require('docx');

const PNB_MAROON = '800000';
const PNB_NAVY = '002060';
const PNB_GOLD = 'B8860B';
const GRAY_BG = 'F4F6F9';
const BORDER_COLOR = 'D0D7DE';

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR }
};

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return {
    fileStamp: `${YYYY}-${MM}-${DD}_${hh}-${mm}-${ss}`,
    displayStamp: `${DD}/${MM}/${YYYY} ${hh}:${mm}:${ss}`
  };
}

async function createChatDocx({
  topic = 'LOAN_PROPOSAL_CONSULTATION',
  userQuery = '',
  agentResponse = '',
  metadata = {},
  outputDir = fs.existsSync('D:\\Bank_Loan_Appraisal\\MASTER_VAULT\\DATA\\000-CHAT_HISTORY')
    ? 'D:\\Bank_Loan_Appraisal\\MASTER_VAULT\\DATA\\000-CHAT_HISTORY'
    : 'G:\\My Drive\\Bank_Loan_Appraisal\\MASTER_VAULT\\DATA\\000-CHAT_HISTORY',
  filename = null
}) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const { fileStamp, displayStamp } = formatTimestamp();
  const safeTopic = topic.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const uniqueToken = Math.random().toString(36).substring(2, 6).toUpperCase();
  const outFileName = filename || `${fileStamp}_${uniqueToken}_${safeTopic}_CHAT.docx`;
  const fullPath = path.join(outputDir, outFileName);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1200,
              right: 1200
            }
          }
        },
        children: [
          // Header / Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: 'PUNJAB NATIONAL BANK',
                bold: true,
                size: 32,
                color: PNB_MAROON,
                font: 'Arial'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 250 },
            children: [
              new TextRun({
                text: 'CREDIT APPRAISAL & PROPOSAL CHAT LOG',
                bold: true,
                size: 24,
                color: PNB_NAVY,
                font: 'Arial'
              })
            ]
          }),

          // Metadata Info Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Date & Time:', bold: true, size: 20, font: 'Arial' })]
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: displayStamp, size: 20, font: 'Arial' })]
                      })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Proposal / Subject:', bold: true, size: 20, font: 'Arial' })]
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: topic, bold: true, color: PNB_MAROON, size: 20, font: 'Arial' })]
                      })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'Archive Vault Path:', bold: true, size: 20, font: 'Arial' })]
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: outputDir, size: 18, color: '555555', font: 'Arial' })]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // User Query Section
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: '1. User Request / Proposal Query',
                bold: true,
                color: PNB_MAROON,
                size: 22,
                font: 'Arial'
              })
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    shading: { fill: 'FAFAFA', type: ShadingType.CLEAR },
                    margins: { top: 120, bottom: 120, left: 150, right: 150 },
                    children: userQuery
                      .split('\n')
                      .filter(Boolean)
                      .map(
                        (line) =>
                          new Paragraph({
                            spacing: { after: 80 },
                            children: [new TextRun({ text: line, size: 20, font: 'Arial' })]
                          })
                      )
                  })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { after: 300 } }),

          // Agent Response / Appraisal Assessment Section
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: '2. Appraisal Assessment & Response',
                bold: true,
                color: PNB_NAVY,
                size: 22,
                font: 'Arial'
              })
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    margins: { top: 140, bottom: 140, left: 150, right: 150 },
                    children: agentResponse
                      .split('\n')
                      .map((line) => {
                        const trimmed = line.trim();
                        const isHeading = trimmed.startsWith('#') || trimmed.startsWith('**') && trimmed.endsWith('**');
                        const isBullet = trimmed.startsWith('*') || trimmed.startsWith('-');
                        const cleanText = trimmed.replace(/^#+\s*/, '').replace(/^\*+\s*/, '').replace(/^-+\s*/, '');
                        return new Paragraph({
                          spacing: { after: 100 },
                          bullet: isBullet ? { level: 0 } : undefined,
                          children: [
                            new TextRun({
                              text: cleanText,
                              bold: isHeading || trimmed.startsWith('**'),
                              color: isHeading ? PNB_NAVY : '000000',
                              size: 20,
                              font: 'Arial'
                            })
                          ]
                        });
                      })
                  })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { after: 400 } }),

          // Footer note
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: 'Generated by Antigravity Autonomous Loan Appraisal System',
                italics: true,
                size: 16,
                color: '888888',
                font: 'Arial'
              })
            ]
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(fullPath, buffer);
  console.log(`Successfully generated chat history docx: ${fullPath}`);
  return fullPath;
}

// Support CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  let topic = 'LOAN_PROPOSAL_DISCUSSION';
  let queryFile = null;
  let responseFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic' && args[i + 1]) topic = args[++i];
    if (args[i] === '--query-file' && args[i + 1]) queryFile = args[++i];
    if (args[i] === '--response-file' && args[i + 1]) responseFile = args[++i];
  }

  const userQuery = queryFile && fs.existsSync(queryFile) ? fs.readFileSync(queryFile, 'utf8') : args[0] || 'Proposal Query';
  const agentResponse = responseFile && fs.existsSync(responseFile) ? fs.readFileSync(responseFile, 'utf8') : args[1] || 'Proposal Response';

  createChatDocx({ topic, userQuery, agentResponse })
    .then((p) => console.log('DOCX Created:', p))
    .catch((err) => {
      console.error('Error generating docx:', err);
      process.exit(1);
    });
}

module.exports = { createChatDocx };
