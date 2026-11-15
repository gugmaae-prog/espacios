"""Offline access-boundary and in-memory decoder tests."""
import importlib.util,io,unittest,zipfile
from pathlib import Path
R=Path(__file__).resolve().parents[1];s=importlib.util.spec_from_file_location('downloads',R/'scripts/capture-aldar-downloads-pass48.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Download(unittest.TestCase):
 def test_exact_publisher_link(self):self.assertTrue(m.link_present(b'<a href="https://vazeno.files.cmp.optimizely.com/download/assets/A+B/id">Download</a>','https://www.aldar.com/page','https://vazeno.files.cmp.optimizely.com/download/assets/A%2BB/id'))
 def test_not_a_link(self):self.assertFalse(m.link_present(b'<script>https://example.com/private</script>','https://www.aldar.com/page','https://example.com/private'))
 def test_wrong_link(self):self.assertFalse(m.link_present(b'<a href="https://other.example/a">Download</a>','https://www.aldar.com/page','https://vazeno.files.cmp.optimizely.com/a'))
 def test_pdf_in_memory(self):self.assertEqual(m.document_text(b'%PDF-1.4 synthetic','application/pdf',lambda b:'fixture text'),'fixture text')
 def test_pdf_mime_mismatch(self):
  with self.assertRaises(ValueError):m.document_text(b'%PDF-1.4','text/html',lambda b:'bad')
 def test_docx_in_memory(self):
  b=io.BytesIO()
  with zipfile.ZipFile(b,'w') as z:z.writestr('word/document.xml','<w:document xmlns:w="urn:word"><w:t>test factual data</w:t></w:document>')
  self.assertEqual(m.document_text(b.getvalue(),'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),'test factual data')
 def test_other_binary_rejected(self):
  with self.assertRaises(ValueError):m.document_text(b'raw','application/octet-stream')
 def test_expansion_limit(self):
  b=io.BytesIO()
  with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:z.writestr('word/document.xml','x'*5000001)
  with self.assertRaises(ValueError):m.document_text(b.getvalue(),'application/zip')
if __name__=='__main__':unittest.main(verbosity=2)
