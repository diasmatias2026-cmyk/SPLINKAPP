(()=>{
  if(document.getElementById('splink-launcher'))return;
  const host=document.createElement('div');host.id='splink-launcher';const root=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');style.textContent='button{position:fixed;right:20px;bottom:24px;z-index:2147483646;border:1px solid #ddd;border-radius:8px;background:#171b1a;color:white;font:600 14px system-ui;padding:12px 18px;cursor:pointer}button:focus-visible{outline:3px solid #6aa9a0;outline-offset:3px}';
  const button=document.createElement('button');button.textContent='Abrir Splink';button.addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN'}));root.append(style,button);document.documentElement.append(host);
  // Useful work only while WhatsApp is open. Alarms provide coarse recovery.
  const pulse=()=>{try{chrome.runtime.sendMessage({type:'PULSE'}).catch(()=>{});}catch{clearInterval(timer);button.textContent='Recarregue para abrir Splink';}};
  const timer=setInterval(pulse,3000);pulse();
})();
