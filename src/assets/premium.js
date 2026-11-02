
(function(){
  const VERSION='20260922-auditfix-v13';
  let attempts=0;
  let connectedMap=null;
  document.documentElement.dataset.aePremiumUi=VERSION;

  function showRecovery(message){
    if(document.querySelector('.ae-map-recovery'))return;
    const host=document.querySelector('#app')||document.body;
    const card=document.createElement('div');
    card.className='ae-map-recovery';
    card.setAttribute('role','alert');
    card.innerHTML='<div><strong>Map needs another moment</strong><span></span></div><button type="button">Retry map</button>';
    card.querySelector('span').textContent=message||'The map engine did not finish loading.';
    card.querySelector('button').addEventListener('click',()=>location.reload());
    host.appendChild(card);
  }

  // Do not hardcode dark paints — Espacios semantic theme owns map colors.
  function paint(){
    try{window.__ESPACIOS_PAINT_MAP__?.()}catch(e){}
  }

  function connect(map){
    if(connectedMap===map){paint();return}
    connectedMap=map;
    const clearRecovery=()=>document.querySelector('.ae-map-recovery')?.remove();
    map.on?.('style.load',()=>{paint();clearRecovery()});
    map.on?.('load',()=>{paint();clearRecovery()});
    if(map.isStyleLoaded?.())paint();
    if(map.getCanvas?.()&&map.getStyle?.()?.layers?.length)clearRecovery();
  }

  function waitForMap(){
    const map=window.__PSR_MAP__;
    if(map){connect(map);return}
    if(attempts++<160)setTimeout(waitForMap,125);
    else showRecovery('The map engine did not finish loading. Check your connection and retry.');
  }

  document.addEventListener('ae:map-recovery',event=>showRecovery(event.detail?.message));
  setTimeout(()=>{if(!window.__PSR_MAP__)showRecovery('The map engine is taking longer than expected to load.')},12000);
  waitForMap();
})();
