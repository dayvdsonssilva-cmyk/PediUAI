// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = "SUA_URL_AQUI";
const SUPABASE_KEY = "SUA_CHAVE_AQUI";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// PEGAR SLUG DA URL
const path = window.location.pathname;
const slug = path.split("/")[2];

console.log("Slug:", slug);

// FUNÇÃO PRINCIPAL
async function carregarRestaurante() {

  if (!slug) {
    document.getElementById("nomeRestaurante").innerText = "Página inicial";
    return;
  }

  const { data, error } = await supabase
    .from('establishments')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    document.getElementById("nomeRestaurante").innerText = "Restaurante não encontrado";
    return;
  }

  document.getElementById("nomeRestaurante").innerText = data.nome;
}

carregarRestaurante();
