#!/usr/bin/env python3
"""Extract primary developer progress tabs by explicit DOM ID association.

Tab labels supply observation periods, never publication/inspection days.
Component percentages remain separate from the explicitly labelled overall value.
"""
from html.parser import HTMLParser
import re

class Node:
 def __init__(self,tag='',attrs=(),parent=None):
  self.tag=tag;self.attrs=dict(attrs);self.parent=parent;self.children=[]
 def text(self):return ' '.join((c.text() if isinstance(c,Node) else c) for c in self.children).strip()
 def walk(self):
  yield self
  for child in self.children:
   if isinstance(child,Node):yield from child.walk()
 def has_class(self,name):return name in self.attrs.get('class','').split()

class Document(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root=Node();self.current=self.root
 def handle_starttag(self,tag,attrs):
  node=Node(tag,attrs,self.current);self.current.children.append(node)
  if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.current=node
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  node=self.current
  while node.parent and node.tag!=tag:node=node.parent
  if node.parent:self.current=node.parent
 def handle_data(self,data):self.current.children.append(data)

MONTHS={name:i+1 for i,name in enumerate(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'])}
def extract(html):
 parser=Document();parser.feed(html);nodes=list(parser.root.walk());ids={}
 for n in nodes:
  if n.attrs.get('id'):ids.setdefault(n.attrs['id'],[]).append(n)
 result=[];seen=set()
 for tab in nodes:
  target=tab.attrs.get('data-bs-target','')
  if not target.startswith('#') or tab.attrs.get('role')!='tab':continue
  label=' '.join(tab.text().split())
  # A blank, annual or otherwise ambiguous label is not promoted to a month.
  match=re.fullmatch(r'([A-Za-z]+)\s+(20\d{2})(?:\s*-\s*(.+))?',label)
  if not match or match[1][:3].lower() not in MONTHS:continue
  key=target[1:]
  if key in seen:raise ValueError('Repeated tab target '+key)
  seen.add(key)
  panels=ids.get(key,[])
  if len(panels)!=1 or panels[0].attrs.get('role')!='tabpanel':raise ValueError('Missing or ambiguous tab panel '+key)
  panel=panels[0];components={};overall=None
  for block in panel.walk():
   if not block.has_class('stat-block'):continue
   titles=[n for n in block.walk() if n.has_class('sb-title')]
   if len(titles)!=1:raise ValueError('Ambiguous statistic title '+key)
   headings=[' '.join(n.text().split()) for n in titles[0].walk() if n.tag in {'h2','h3','h4'}]
   if len(headings)!=2:raise ValueError('Expected label and percentage '+key)
   metric,raw=headings;value_match=re.fullmatch(r'(\d+(?:\.\d+)?)\s*%',raw)
   if not value_match:raise ValueError('Unrecognized progress value '+raw)
   value=float(value_match[1])
   if not 0<=value<=100:raise ValueError('Out-of-range progress')
   if metric.lower() in {'overall','overall progress','total'}:
    if overall is not None:raise ValueError('Duplicate overall '+key)
    overall=value
   else:
    if metric in components:raise ValueError('Duplicate component '+key)
    components[metric]=value
  if overall is None:
   if components:raise ValueError('Components without overall '+key)
   continue
  result.append({'tabId':tab.attrs.get('id'),'panelId':key,'sourceTabLabel':label,'period':f'{match[2]}-{MONTHS[match[1][:3].lower()]:02d}','phaseLabel':match[3] or None,'overallPercent':overall,'components':components})
 return result

if __name__=='__main__':
 import json,sys
 from pathlib import Path
 print(json.dumps(extract(Path(sys.argv[1]).read_text()),indent=2))
