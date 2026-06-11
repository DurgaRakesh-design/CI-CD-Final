import JSZip from 'jszip';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function createDocumentDocxBlob(doc) {
  const zip = new JSZip();
  const title = String(doc?.title || 'Document');
  const content = buildDocumentLines(doc);

  zip.file('[Content_Types].xml', buildContentTypesXml());
  zip.folder('_rels').file('.rels', buildRootRelsXml());
  zip.folder('docProps').file('core.xml', buildCorePropsXml(title));
  zip.folder('docProps').file('app.xml', buildAppPropsXml(title));
  zip.folder('word').file('document.xml', buildDocumentXml(content));
  zip.folder('word').folder('_rels').file('document.xml.rels', buildDocumentRelsXml());

  return await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME });
}

function buildDocumentLines(doc) {
  const lines = [];
  const title = String(doc?.title || 'Document');
  const moduleName = String(doc?.module || 'Application');
  const type = String(doc?.type || 'Document');
  const business = String(doc?.content || '').trim();
  const gherkin = String(doc?.gherkinContent || '').trim();

  lines.push({ text: title, bold: true, size: 30 });
  lines.push({ text: `${type} | Module: ${moduleName}`, italic: true, size: 18 });
  lines.push({ text: '' });

  if (type === 'BDD') {
    lines.push({ text: 'Business View', bold: true, size: 22 });
    if (business) {
      business.split(/\r?\n/).forEach((line) => lines.push({ text: line }));
    } else {
      lines.push({ text: 'No business view text was generated.' });
    }
    lines.push({ text: '' });
    lines.push({ text: 'Gherkin Preview', bold: true, size: 22 });
    if (gherkin) {
      gherkin.split(/\r?\n/).forEach((line) => lines.push({ text: line }));
    } else {
      lines.push({ text: 'No Gherkin content was generated.' });
    }
    return lines;
  }

  lines.push({ text: 'BRD Content', bold: true, size: 22 });
  if (business) {
    business.split(/\r?\n/).forEach((line) => lines.push({ text: line }));
  } else {
    lines.push({ text: 'No BRD content was generated.' });
  }

  return lines;
}

function buildDocumentXml(content) {
  const body = content.map((line) => paragraphXml(line)).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function paragraphXml(line) {
  const text = escapeXml(line?.text ?? '');
  const size = line?.size || 20;
  const runs = [];
  const runPr = [`<w:sz w:val="${size}"/>`];
  if (line?.bold) runPr.push('<w:b/>');
  if (line?.italic) runPr.push('<w:i/>');

  if (!String(line?.text ?? '').trim()) {
    return '<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>';
  }

  runs.push(
    `<w:r><w:rPr>${runPr.join('')}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`
  );
  return `<w:p>${runs.join('')}</w:p>`;
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function buildRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function buildDocumentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
}

function buildCorePropsXml(title) {
  const safeTitle = escapeXml(title);
  const created = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${safeTitle}</dc:title>
  <dc:creator>VeriSphere AI</dc:creator>
  <cp:lastModifiedBy>VeriSphere AI</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified>
</cp:coreProperties>`;
}

function buildAppPropsXml(title) {
  const safeTitle = escapeXml(title);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>VeriSphere AI</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Title</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>${safeTitle}</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company>VeriSphere AI</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
