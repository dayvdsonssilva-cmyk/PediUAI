// â”€â”€â”€ PLAN / PAYMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setBilling(cycle, btn) {
  billingCycle = cycle;
  document.querySelectorAll('.billing-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updatePlanPrices();
}
function updatePlanPrices() {
  const b = billingCycle === 'annual';
  document.getElementById('price-basico').textContent = b ? 'R$ 29,90' : 'R$ 39,90';
  document.getElementById('price-ultra').textContent = b ? 'R$ 79,90' : 'R$ 99,90';
  document.getElementById('annual-basico').style.display = b ? 'block' : 'none';
  document.getElementById('annual-ultra').style.display = b ? 'block' : 'none';
}
function selectPlan(plan) {
  selectedPlan = plan;
  document.getElementById('plan-basico').classList.toggle('selected', plan==='basico');
  document.getElementById('plan-ultra').classList.toggle('selected', plan==='ultra');
  const info = document.getElementById('plan-selected-info');
  const price = billingCycle === 'annual' ? (plan === 'basico' ? 'R$ 29,90/mÃªs' : 'R$ 79,90/mÃªs') : (plan === 'basico' ? 'R$ 39,90/mÃªs' : 'R$ 99,90/mÃªs');
  info.style.display = 'block';
  document.getElementById('psi-title').textContent = (plan === 'basico' ? 'Plano BÃ¡sico â€” ' : 'Plano Ultra â€” ') + price;
  document.getElementById('psi-desc').textContent = plan === 'basico' ? 'CardÃ¡pio digital completo com pedidos ilimitados.' : 'Tudo do BÃ¡sico + Financeiro, relatÃ³rios 90 dias e IA de automaÃ§Ã£o.';
}
function goToMercadoPago() {
  if (!selectedPlan) { alert('Selecione um plano primeiro'); return; }
  if (!window._pendingReg) { goTo('s-register'); return; }
  const price = selectedPlan === 'basico' ? (billingCycle === 'annual' ? 29.90 : 39.90) : (billingCycle === 'annual' ? 79.90 : 99.90);
  // Em produÃ§Ã£o: redireciona para o Mercado Pago via backend
  // window.location.href = '/api/subscribe?plan='+selectedPlan+'&billing='+billingCycle;
  alert('Em produÃ§Ã£o isto abre o Mercado Pago.\n\nPlano ' + (selectedPlan==='basico'?'BÃ¡sico':'Ultra') + ' Â· R$ ' + price.toFixed(2).replace('.',',') + '/mÃªs\n\nUse "Simular pagamento" para testar agora.');
}
function simulatePayment() {
  const reg = window._pendingReg;
  if (!reg || !reg.name) { alert('Dados do cadastro nÃ£o encontrados. Volte e preencha o formulÃ¡rio.'); goTo('s-register'); return; }
  if (!selectedPlan) { alert('Selecione um plano.'); return; }
  const slug = gerarSlug(reg.name);
  const newUser = {
    id: Date.now().toString(),
    name: reg.name, desc: reg.desc||'', emoji: 'ðŸ”', color: '#E8410A',
    slug, logo: reg.logo||null, email: reg.email, pass: reg.pass,
    whatsapp: digits(reg.wp||'5511999999999'),
    plan: selectedPlan, status: 'pending', dueDate: getDueDate(),
    payMethod: 'Mercado Pago', since: new Date().toISOString().slice(0,10),
    doc: reg.doc||'', orders: [], menuItems: [], flashItems: [], welcome: 'Seja bem-vindo!'
  };
  const solics = getSolicitations();
  solics.push({...newUser, submittedAt: new Date().toLocaleDateString('pt-BR')});
  setSolicitations(solics);

  // Salva como pendente no Supabase para o CEO ver de qualquer celular
  const db = getSupa();
  if (db) {
    db.from('estabelecimentos').insert({
      name: newUser.name, doc: newUser.doc||'', email: newUser.email,
      pass: newUser.pass, password_plain: newUser.pass,
      whatsapp: newUser.whatsapp||'', descricao: newUser.desc||'',
      slug: newUser.slug, emoji: 'ðŸ”', color: '#E8410A',
      plan_type: 'ultra', status: 'pending',
      logo_url: newUser.logo||null, created_at: new Date().toISOString()
    }).then(({error}) => {
      if (error) console.warn('Cadastro Supabase erro:', error.message);
    });
  }

  window._pendingReg = null;
  document.getElementById('pend-email').textContent = reg.email;
  goTo('s-pending');
}
function getDueDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + (billingCycle === 'annual' ? 12 : 1));
  return d.toLocaleDateString('pt-BR');
}

