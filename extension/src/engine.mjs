import { uid, terminal, renderVariables, matchRules, createCampaign } from './domain.mjs';
export class Engine {
  constructor(store,transport,{now=Date.now,random=Math.random}={}){this.store=store;this.transport=transport;this.now=now;this.random=random;this.busy=false;}
  async tick(){
    if(this.busy)return;this.busy=true;
    try {
      const now=this.now();
      await this.store.mutate(s=>{
        for(const j of s.jobs){
          if(j.status==='running'&&j.leaseUntil<now){j.status='unknown';j.error='Execução interrompida. Confira a conversa antes de reenviar.';s.events.unshift({id:uid(),jobId:j.id,campaignId:j.campaignId,profile:j.profile,phone:j.recipient.phone,nodeId:j.nodeId,attemptId:j.claimId,at:now,outcome:'unknown',error:j.error});}
          if(j.status!=='running'&&!terminal(j.status)&&j.desired==='cancelled')j.status='cancelled';
          if(j.status!=='running'&&j.status!=='paused'&&!terminal(j.status)&&j.desired==='paused'){j.resumeStatus=j.status;j.status='paused';}
          if(j.status==='paused'&&j.desired==='active'){j.status=j.resumeStatus??'queued';delete j.resumeStatus;}
          if(j.status==='waiting'&&!j.nodeId&&j.wakeAt<=now)j.status='completed';
          if(j.status==='waiting-response'&&j.wakeAt<=now){const n=j.sequence.nodes.find(n=>n.id===j.nodeId);j.nodeId=n.onTimeout??null;j.status=j.nodeId?'queued':'completed';}
        }
      });
      const status=await this.transport.status();if(!status.ready)return;
      let claimed;
      await this.store.mutate(s=>{
        const job=s.jobs.find((j,index)=>j.profile===status.profile&&j.desired==='active'&&['queued','waiting'].includes(j.status)&&j.wakeAt<=now&&(s.nextAllowed[j.profile]??0)<=now&&!s.jobs.slice(0,index).some(other=>other.profile===j.profile&&other.recipient.phone===j.recipient.phone&&!terminal(other.status)));
        if(!job)return;
        if(s.contacts.some(c=>c.phone===job.recipient.phone&&c.optOut)){job.status='cancelled';job.error='Contato na lista de não enviar.';return;}
        if(++job.steps>500){job.status='failed';job.error='Limite de etapas excedido.';return;}
        job.claimId=uid();job.status='running';job.leaseUntil=now+60000;job.updatedAt=now;claimed=structuredClone(job);
      });
      if(!claimed)return;
      const node=claimed.sequence.nodes.find(n=>n.id===claimed.nodeId);
      if(!node){await this.finish(claimed,{error:'Nó de execução ausente.',outcome:'failed'});return;}
      if(node.type==='delay'){await this.finish(claimed,{next:node.next,wakeAt:now+node.seconds*1000,outcome:'waiting'});return;}
      if(node.type==='response'){await this.finish(claimed,{next:node.id,wakeAt:now+node.timeout*1000,outcome:'waiting-response'});return;}
      if(node.type==='random'){
        const total=node.branches.reduce((a,b)=>a+b.weight,0);let sample=this.random()*total;
        const branch=node.branches.find(b=>(sample-=b.weight)<0)??node.branches.at(-1);
        await this.finish(claimed,{next:branch.next,outcome:'waiting',wakeAt:now});return;
      }
      let item;
      try{item={...node.item,body:renderVariables(node.item.body??'',claimed.recipient),caption:renderVariables(node.item.caption??'',claimed.recipient)};}
      catch(e){await this.finish(claimed,{error:e.message,outcome:'failed'});return;}
      try {
        const result=await this.transport.send({profile:claimed.profile,to:claimed.recipient.phone,item,attemptId:claimed.claimId});
        await this.finish(claimed,{next:node.next,outcome:'accepted',messageId:result.id});
      } catch(e) {await this.finish(claimed,{error:e.message,outcome:e.beforeSend?'failed':'unknown'});}
    } finally {this.busy=false;}
  }
  async finish(claim,result){
    const now=this.now();await this.store.mutate(s=>{
      const j=s.jobs.find(j=>j.id===claim.id);if(!j||j.claimId!==claim.claimId)return;
      const sent=result.outcome==='accepted';
      if(sent||result.error){const ack=s.acks?.[`${j.profile}:${result.messageId}`];s.events.unshift({id:uid(),jobId:j.id,campaignId:j.campaignId,profile:j.profile,phone:j.recipient.phone,nodeId:j.nodeId,attemptId:claim.claimId,at:now,outcome:result.outcome,messageId:result.messageId??null,error:result.error??null,...(ack?{ack:ack.ack,ackAt:ack.at,delivery:ack.ack>=4?'played':ack.ack>=3?'read':ack.ack>=2?'delivered':null}:{})});}
      s.events=s.events.slice(0,20000);j.updatedAt=now;j.error=result.error??null;
      if('next' in result)j.nodeId=result.next;
      j.wakeAt=result.wakeAt??now;
      const pendingDelay=result.outcome==='waiting'&&j.wakeAt>now;
      j.status=j.desired==='cancelled'?'cancelled':result.error?result.outcome:!j.nodeId&&!pendingDelay?'completed':j.desired==='paused'?'paused':sent?'queued':result.outcome;
      if(j.status==='paused')j.resumeStatus=sent?'queued':result.outcome;
      if(result.outcome==='waiting-response')j.waitStartedAt=now;
      if(terminal(j.status))j.completedAt=now;
      if(sent){const c=s.campaigns.find(c=>c.id===j.campaignId);s.nextAllowed[j.profile]=now+((c?.delayMin??6)+this.random()*((c?.delayMax??16)-(c?.delayMin??6)))*1000;}
      delete j.claimId;delete j.leaseUntil;
    });
  }
  async ack(event){
    if(!Array.isArray(event.ids)||event.ids.length>100||!Number.isInteger(event.ack)||event.ack<0||event.ack>4||typeof event.profile!=='string')return;
    const at=this.now();await this.store.mutate(s=>{
      s.acks??={};
      for(const id of event.ids.filter(id=>typeof id==='string'&&id.length<=300)){
        const key=`${event.profile}:${id}`;
        if((s.acks[key]?.ack??-1)>event.ack)continue;
        s.acks[key]={ack:event.ack,at};
        for(const e of s.events.filter(e=>e.messageId===id&&e.profile===event.profile)){
          e.ack=event.ack;e.ackAt=at;e.delivery=event.ack>=4?'played':event.ack>=3?'read':event.ack>=2?'delivered':null;
        }
      }
      const keys=Object.keys(s.acks);for(const key of keys.slice(0,Math.max(0,keys.length-5000)))delete s.acks[key];
    });
  }
  async incoming(event){
    if(!event.id||event.fromMe||event.isGroup||!/^\d{8,15}$/.test(event.phone)||typeof event.body!=='string'||!event.body.trim())return;
    const now=this.now();await this.store.mutate(s=>{
      const key=`${event.profile}:${event.id}`;if(s.seen.includes(key))return;s.seen.push(key);s.seen=s.seen.slice(-5000);
      if(s.contacts.some(c=>c.phone===event.phone&&c.optOut))return;
      let resumed=false;
      for(const j of s.jobs.filter(j=>j.profile===event.profile&&j.recipient.phone===event.phone&&j.status==='waiting-response'&&j.desired==='active')) {
        const at=event.at??now;if(at<j.waitStartedAt||at>j.wakeAt)continue;
        const node=j.sequence.nodes.find(n=>n.id===j.nodeId);
        const matches=!node.expected||matchRules(event.body,[{operator:node.operator??'contains',words:[node.expected]}]);
        if(!matches&&!node.onDifferent){resumed=true;break;}
        j.nodeId=matches?node.next:node.onDifferent;j.status=j.nodeId?'queued':'completed';j.wakeAt=now;resumed=true;break;
      }
      if(resumed)return;
      for(const t of s.triggers.filter(t=>t.enabled&&t.profile===event.profile)){
        const cooldownKey=`${t.id}:${event.phone}`;
        if((s.cooldowns[cooldownKey]??0)>now||!matchRules(event.body,t.rules,t.caseSensitive))continue;
        if(s.jobs.some(j=>j.profile===event.profile&&j.recipient.phone===event.phone&&!terminal(j.status)))continue;
        createCampaign(s,{name:`Gatilho: ${t.name}`,profile:t.profile,recipients:[{phone:event.phone,name:event.name||'Contato',fields:{}}],source:t.source,delayMin:6,delayMax:16,scheduledAt:now+(t.delay??0)*1000},now);
        s.cooldowns[cooldownKey]=now+(t.cooldown??86400)*1000;
      }
    });
  }
}
