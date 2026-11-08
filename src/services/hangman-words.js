/**
 * Dicionário do Jogo da Forca, organizado por categoria e dificuldade.
 * A categoria aparece como dica para os jogadores.
 *
 * - facil: palavra do dia a dia.
 * - medio: conhecida, mas menos comum ou mais comprida.
 * - dificil: rara, regional, técnica ou composta.
 *
 * Para adicionar palavras, basta incluir na lista do nível
 * (com acento mesmo: o jogo normaliza Á/Ã/Â/Ç na hora de chutar).
 * Em frases e nomes compostos, use hífen no lugar do espaço.
 *
 * @author bot_marc
 */
export const HANGMAN_WORDS = {
  "🐾 Animal": {
    facil: [
      "cachorro", "gato", "elefante", "girafa", "jacaré", "tartaruga", "borboleta", "papagaio",
      "macaco", "leão", "tigre", "onça", "lobo", "raposa", "coelho", "esquilo", "camelo", "canguru",
      "coala", "pinguim", "golfinho", "baleia", "tubarão", "polvo", "lula", "caranguejo", "camarão",
      "cavalo", "zebra", "burro", "vaca", "ovelha", "cabra", "porco", "galinha", "pato", "ganso",
      "peru", "coruja", "águia", "urubu", "tucano", "arara", "pavão", "morcego", "rato", "hamster",
      "tatu", "capivara", "anta", "sapo", "rã", "formiga", "abelha", "mosquito", "barata", "grilo",
      "aranha", "minhoca", "caracol", "lesma", "foca", "urso", "panda", "gorila", "veado", "peixe",
      "galo", "pulga", "piolho", "boi", "bode", "pintinho", "mico",
    ],
    medio: [
      "hipopótamo", "rinoceronte", "lagosta", "falcão", "gavião", "beija-flor", "periquito",
      "avestruz", "flamingo", "cisne", "tamanduá", "preguiça", "jabuti", "sucuri", "jiboia",
      "cascavel", "lagarto", "camaleão", "iguana", "vespa", "gafanhoto", "joaninha", "libélula",
      "escorpião", "medusa", "estrela-do-mar", "cavalo-marinho", "morsa", "guaxinim", "chimpanzé",
      "leopardo", "guepardo", "hiena", "javali", "búfalo", "lhama", "alpaca", "suricato", "lince",
      "quati", "jararaca", "piranha", "tilápia", "pirarucu", "bem-te-vi", "sabiá", "canário",
      "curió", "lobo-guará", "mico-leão-dourado", "tatu-bola", "siri", "sagui", "jumento", "cutia",
      "paca", "preá", "marimbondo", "lacraia", "vagalume", "tico-tico", "pardal", "bicho-preguiça",
    ],
    dificil: [
      "dromedário", "porquinho-da-índia", "salamandra", "orangotango", "alce", "bisão",
      "ornitorrinco", "ariranha", "tamanduá-bandeira", "peixe-boi", "uirapuru", "jaguatirica",
      "queixada", "teiú", "surucucu", "mutum", "seriema", "quero-quero", "araponga", "gralha-azul",
      "harpia", "muriqui", "bugio", "tracajá", "tambaqui", "mandi", "boto-cor-de-rosa", "caititu",
      "irara", "jacu", "inhambu", "acará-bandeira", "jandaia", "maritaca", "sanhaço", "saracura",
      "lambari", "pintado", "cachara", "muçum",
    ],
  },
  "🍎 Fruta": {
    facil: [
      "abacaxi", "banana", "maçã", "laranja", "limão", "morango", "uva", "melancia", "melão",
      "mamão", "manga", "goiaba", "caju", "coco", "pera", "figo", "jaca", "ameixa", "cereja",
      "abacate", "kiwi", "lima",
    ],
    medio: [
      "maracujá", "acerola", "jabuticaba", "pitanga", "graviola", "açaí", "pêssego", "framboesa",
      "amora", "tangerina", "mexerica", "carambola", "romã", "tâmara", "fruta-do-conde", "damasco",
      "cacau", "caqui", "nêspera", "atemoia", "pinha", "ingá", "guaraná", "banana-da-terra",
      "laranja-lima", "limão-siciliano", "bergamota", "pokan",
    ],
    dificil: [
      "cupuaçu", "mirtilo", "pitaia", "lichia", "nectarina", "groselha", "cajá", "umbu",
      "seriguela", "bacuri", "buriti", "pequi", "jambo", "sapoti", "mangaba", "tucumã", "taperebá",
      "murici", "araçá", "cambuci", "guabiroba", "uvaia", "pupunha", "jenipapo", "bocaiuva",
      "cagaita", "marolo", "mangostão", "cajarana", "camu-camu", "pitomba", "macaúba", "abiu",
    ],
  },
  "🍲 Comida": {
    facil: [
      "pizza", "churrasco", "coxinha", "pastel", "brigadeiro", "pudim", "pipoca", "macarrão",
      "lasanha", "feijoada", "sanduíche", "torrada", "biscoito", "bolacha", "chocolate", "sorvete",
      "picolé", "gelatina", "queijo", "presunto", "salsicha", "linguiça", "bacon", "maionese",
      "ketchup", "mostarda", "salada", "sopa", "caldo", "lanche", "marmita", "arroz", "feijão",
      "batata", "cenoura", "tomate", "cebola", "alho", "alface", "couve", "hambúrguer", "omelete",
      "panqueca", "farofa", "mandioca", "beijinho", "sonho", "taco", "bolo", "pão", "ovo", "carne",
      "frango", "leite", "manteiga", "pão-de-queijo", "cachorro-quente", "misto-quente",
    ],
    medio: [
      "esfirra", "empada", "quindim", "cocada", "paçoca", "pamonha", "canjica", "tapioca", "cuscuz",
      "acarajé", "moqueca", "baião", "polenta", "risoto", "estrogonofe", "rapadura", "goiabada",
      "requeijão", "salame", "mortadela", "vinagrete", "torresmo", "rosquinha", "sushi", "temaki",
      "yakisoba", "nachos", "burrito", "galinhada", "beterraba", "abobrinha", "berinjela", "chuchu",
      "quiabo", "jiló", "brócolis", "buchada", "sarapatel", "escondidinho", "baião-de-dois",
      "bolinho-de-chuva", "arroz-doce", "carne-de-sol", "charque", "cajuzinho", "pé-de-moleque",
      "rabanada", "pão-francês", "macaxeira", "aipim", "bolo-de-fubá", "feijão-tropeiro",
      "dobradinha", "rocambole",
    ],
    dificil: [
      "curau", "vatapá", "bobó", "tacacá", "tutu", "croissant", "waffle", "guacamole", "maniçoba",
      "pato-no-tucupi", "tucupi", "caruru", "jambu", "sururu", "xinxim", "barreado", "arroz-de-cuxá",
      "quibebe", "mungunzá", "bolo-de-rolo", "cartola", "sarrabulho", "beiju", "aluá", "arrumadinho",
      "paçoca-de-carne-seca", "cabidela", "galinha-de-cabidela", "virado-à-paulista", "bauru",
      "tainha-na-taquara", "entrevero", "arroz-carreteiro", "chimarrão", "tererê",
    ],
  },
  "👷 Profissão": {
    facil: [
      "médico", "enfermeiro", "dentista", "advogado", "professor", "bombeiro", "policial",
      "carteiro", "motorista", "piloto", "cozinheiro", "garçom", "padeiro", "pedreiro", "pintor",
      "jardineiro", "pescador", "cantor", "ator", "músico", "escritor", "vendedor", "caixa",
      "barbeiro", "soldado", "juiz", "taxista", "guia", "feirante", "gari", "babá", "doméstica",
    ],
    medio: [
      "engenheiro", "arquiteto", "programador", "comissário", "açougueiro", "eletricista",
      "encanador", "marceneiro", "carpinteiro", "agricultor", "veterinário", "jornalista",
      "fotógrafo", "dançarino", "poeta", "astronauta", "cientista", "secretário", "cabeleireiro",
      "manicure", "costureira", "alfaiate", "sapateiro", "mecânico", "borracheiro", "frentista",
      "vigilante", "porteiro", "faxineiro", "zelador", "promotor", "delegado", "detetive",
      "marinheiro", "aviador", "entregador", "influenciador", "youtuber", "designer", "tradutor",
      "contador", "administrador", "recepcionista", "ambulante", "mototaxista", "lavrador",
      "vaqueiro", "pipoqueiro", "sorveteiro", "cordelista", "repentista", "mestre-de-obras",
      "garimpeiro", "capoeirista", "camelô", "cobrador", "serralheiro", "motoboy",
    ],
    dificil: [
      "farmacêutico", "psicólogo", "fisioterapeuta", "nutricionista", "biólogo", "químico",
      "físico", "matemático", "historiador", "geógrafo", "economista", "bibliotecário",
      "publicitário", "intérprete", "otorrinolaringologista", "oftalmologista", "anestesista",
      "ginecologista", "paleontólogo", "arqueólogo", "sommelier", "taxidermista", "meteorologista",
      "ortodontista", "seringueiro", "jangadeiro", "baiana-de-acarajé", "fonoaudiólogo",
      "antropólogo", "sociólogo", "desembargador", "tabelião", "despachante", "ferrador",
      "quebradeira-de-coco", "sertanista", "maquinista", "ourives",
    ],
  },
  "🌎 País": {
    facil: [
      "brasil", "argentina", "uruguai", "paraguai", "chile", "bolívia", "peru", "méxico", "canadá",
      "cuba", "portugal", "espanha", "frança", "itália", "alemanha", "inglaterra", "holanda",
      "japão", "china", "índia", "egito", "angola", "rússia", "grécia", "turquia", "estados-unidos",
    ],
    medio: [
      "equador", "colômbia", "venezuela", "jamaica", "haiti", "panamá", "escócia", "irlanda",
      "bélgica", "suíça", "áustria", "polônia", "suécia", "noruega", "finlândia", "dinamarca",
      "ucrânia", "croácia", "marrocos", "moçambique", "coreia", "tailândia", "austrália", "israel",
      "senegal", "nigéria", "irã", "iraque", "islândia", "hungria", "costa-rica", "guatemala",
      "honduras", "nicarágua", "áfrica-do-sul", "cabo-verde",
    ],
    dificil: [
      "sérvia", "romênia", "quênia", "etiópia", "camarões", "vietnã", "indonésia", "filipinas",
      "nova-zelândia", "líbano", "arábia", "catar", "paquistão", "afeganistão", "mongólia", "nepal",
      "singapura", "malásia", "guiné-bissau", "são-tomé-e-príncipe", "timor-leste", "butão",
      "quirguistão", "uzbequistão", "azerbaijão", "madagascar", "zimbábue", "suriname", "guiana",
      "el-salvador", "república-dominicana", "liechtenstein", "bangladesh", "cazaquistão",
    ],
  },
  "🏙️ Cidade brasileira": {
    facil: [
      "salvador", "recife", "fortaleza", "manaus", "belém", "curitiba", "natal", "brasília",
      "santos", "vitória", "palmas", "bonito", "gramado", "canela", "são-paulo", "rio-de-janeiro",
      "belo-horizonte",
    ],
    medio: [
      "florianópolis", "porto-alegre", "goiânia", "cuiabá", "campo-grande", "maceió", "aracaju",
      "teresina", "joão-pessoa", "macapá", "boa-vista", "rio-branco", "porto-velho", "londrina",
      "maringá", "joinville", "blumenau", "campinas", "sorocaba", "petrópolis", "niterói", "paraty",
      "ouro-preto", "olinda", "caruaru", "petrolina", "juazeiro", "ilhéus", "porto-seguro",
      "santarém", "foz-do-iguaçu", "são-luís", "guarulhos", "osasco", "caxias-do-sul", "pelotas",
      "ponta-grossa", "cascavel", "imperatriz", "sobral", "diamantina", "tiradentes", "lençóis",
      "piracicaba", "balneário-camboriú",
    ],
    dificil: [
      "ribeirão-preto", "uberlândia", "juiz-de-fora", "mossoró", "feira-de-santana", "itabuna",
      "campina-grande", "parintins", "jericoacoara", "fernando-de-noronha", "vitória-da-conquista",
      "jequié", "barreiras", "alagoinhas", "camaçari", "lauro-de-freitas",
      "cachoeiro-de-itapemirim", "são-josé-do-rio-preto", "governador-valadares", "alter-do-chão",
      "barreirinhas", "paulo-afonso", "teixeira-de-freitas", "pirenópolis", "mogi-das-cruzes",
      "itaquaquecetuba", "pindamonhangaba", "quixeramobim", "xique-xique", "são-bernardo-do-campo",
      "juazeiro-do-norte", "garanhuns", "arapiraca", "cruz-das-almas",
    ],
  },
  "🏠 Objeto da casa": {
    facil: [
      "geladeira", "fogão", "panela", "garrafa", "copo", "xícara", "prato", "garfo", "faca",
      "colher", "tesoura", "vassoura", "rodo", "pano", "balde", "esponja", "sabonete", "toalha",
      "travesseiro", "cobertor", "lençol", "colchão", "cama", "sofá", "cadeira", "mesa", "armário",
      "gaveta", "espelho", "tapete", "cortina", "lâmpada", "ventilador", "televisão", "controle",
      "relógio", "chave", "tomada", "carregador", "ferro", "varal", "lixeira", "escova", "pente",
      "chuveiro", "torneira", "pia", "ralo", "privada", "rede", "bule",
    ],
    medio: [
      "microondas", "liquidificador", "batedeira", "torradeira", "frigideira", "chaleira", "talher",
      "concha", "peneira", "abridor", "detergente", "poltrona", "estante", "guarda-roupa", "cabide",
      "persiana", "abajur", "ar-condicionado", "despertador", "campainha", "fechadura", "cadeado",
      "interruptor", "extensão", "aspirador", "pregador", "secador", "banheira", "ralador",
      "espremedor", "amaciante", "botijão", "sapateira", "fruteira", "garrafa-térmica",
      "panela-de-pressão", "tábua-de-passar", "porta-retrato",
    ],
    dificil: [
      "escumadeira", "saca-rolhas", "cristaleira", "penteadeira", "cômoda", "criado-mudo",
      "descascador", "moedor", "desentupidor", "moringa", "filtro-de-barro", "mancebo", "pilão",
      "gamela", "abanador", "quartinha", "tamborete", "cuscuzeira", "cantoneira", "bidê",
      "castiçal", "candelabro", "sifão", "ferro-de-brasa",
    ],
  },
  "⚽ Esporte": {
    facil: [
      "futebol", "basquete", "vôlei", "tênis", "natação", "boxe", "judô", "skate", "surfe",
      "xadrez", "corrida", "salto", "remo", "peteca", "queimada", "futsal", "golfe", "pelada",
    ],
    medio: [
      "handebol", "atletismo", "ciclismo", "caratê", "capoeira", "ginástica", "beisebol", "rúgbi",
      "hóquei", "canoagem", "vela", "maratona", "sinuca", "boliche", "dardos", "escalada",
      "patinação", "esqui", "frescobol", "bocha", "taco", "polo", "arremesso", "levantamento",
      "altinha", "futevôlei", "vaquejada", "rapel", "cabo-de-guerra", "bodyboard", "taco-de-rua",
    ],
    dificil: [
      "taekwondo", "jiu-jitsu", "esgrima", "triatlo", "paraquedismo", "motocross", "automobilismo",
      "badminton", "pingue-pongue", "críquete", "curling", "snowboard", "kitesurfe", "tamboréu",
      "biribol", "slackline", "pentatlo", "decatlo", "nado-artístico", "tiro-com-arco", "luge",
      "muay-thai", "levantamento-de-peso",
    ],
  },
  "🚗 Transporte": {
    facil: [
      "carro", "moto", "bicicleta", "ônibus", "caminhão", "trem", "metrô", "avião", "navio",
      "barco", "foguete", "balão", "táxi", "van", "lotação",
    ],
    medio: [
      "helicóptero", "canoa", "lancha", "jangada", "submarino", "patinete", "skate", "carroça",
      "charrete", "trator", "ambulância", "viatura", "caminhonete", "jipe", "bonde", "iate",
      "veleiro", "balsa", "mototáxi", "pau-de-arara", "carro-de-boi", "catamarã", "gôndola",
      "bondinho", "trem-bala", "carreta", "bicicleta-elétrica",
    ],
    dificil: [
      "dirigível", "limusine", "teleférico", "planador", "triciclo", "monociclo", "riquixá",
      "escavadeira", "guindaste", "hovercraft", "empilhadeira", "retroescavadeira", "transatlântico",
      "zepelim", "voadeira", "ultraleve", "bitrem", "rabeta", "batelão",
    ],
  },
  "🎸 Instrumento musical": {
    facil: [
      "violão", "guitarra", "baixo", "bateria", "piano", "teclado", "flauta", "sanfona", "pandeiro",
      "gaita", "triângulo", "violino", "tambor", "apito", "corneta",
    ],
    medio: [
      "viola", "contrabaixo", "clarinete", "saxofone", "trompete", "trombone", "tuba", "acordeão",
      "cavaquinho", "bandolim", "berimbau", "tamborim", "cuíca", "surdo", "chocalho", "reco-reco",
      "harpa", "órgão", "ukulele", "banjo", "xilofone", "zabumba", "tantã", "repique", "rabeca",
      "ganzá", "caxixi", "afoxé", "pífano", "viola-caipira", "cravo", "tímpano",
    ],
    dificil: [
      "violoncelo", "agogô", "atabaque", "oboé", "fagote", "castanholas", "marimba", "cítara",
      "alaúde", "timbal", "rebolo", "ocarina", "clavicórdio", "vibrafone", "corne-inglês",
      "bombardino", "alfaia", "matraca", "tamboril", "viola-de-cocho",
    ],
  },
  "💻 Tecnologia": {
    facil: [
      "computador", "celular", "tablet", "teclado", "mouse", "monitor", "internet", "senha", "robô",
      "wifi", "câmera", "drone", "fone", "emoji", "figurinha", "mensagem", "vírus", "notebook",
      "programa", "nuvem", "bateria", "carregador", "pix", "meme", "print",
    ],
    medio: [
      "impressora", "roteador", "aplicativo", "software", "hardware", "processador", "memória",
      "pendrive", "servidor", "navegador", "videogame", "microfone", "webcam", "download", "upload",
      "backup", "hacker", "antena", "satélite", "android", "windows", "linux", "python", "chatbot",
      "joystick", "streaming", "podcast", "biometria", "sensor", "planilha", "fibra-óptica",
    ],
    dificil: [
      "algoritmo", "inteligência", "javascript", "bluetooth", "touchscreen", "firewall",
      "criptomoeda", "blockchain", "criptografia", "compilador", "banco-de-dados",
      "inteligência-artificial", "nanotecnologia", "realidade-virtual", "placa-de-vídeo",
      "semicondutor", "processamento", "autenticação", "virtualização",
    ],
  },
  "👕 Roupa e acessório": {
    facil: [
      "camiseta", "camisa", "blusa", "calça", "bermuda", "short", "saia", "vestido", "casaco",
      "jaqueta", "pijama", "cueca", "calcinha", "meia", "sapato", "tênis", "sandália", "chinelo",
      "bota", "chapéu", "boné", "luva", "cinto", "bolsa", "mochila", "carteira", "óculos",
      "relógio", "colar", "brinco", "anel", "uniforme", "faixa",
    ],
    medio: [
      "moletom", "suéter", "colete", "terno", "gravata", "sutiã", "touca", "cachecol", "pulseira",
      "biquíni", "maiô", "sunga", "avental", "macacão", "jardineira", "regata", "capa", "rasteirinha",
      "abadá", "bandana", "tiara", "suspensório", "cardigã", "sobretudo", "tornozeleira", "coturno",
      "bracelete", "peruca", "tamanco", "turbante", "chapéu-de-palha",
    ],
    dificil: [
      "cropped", "legging", "poncho", "quimono", "alpargata", "gargantilha", "bombacha", "pala",
      "gibão", "chapéu-de-couro", "espadrille", "mocassim", "pelerine", "balaclava", "espartilho",
      "abotoadura", "torço-de-baiana",
    ],
  },
  "🌿 Natureza": {
    facil: [
      "floresta", "montanha", "cachoeira", "rio", "lago", "oceano", "praia", "deserto", "vulcão",
      "ilha", "neve", "chuva", "nuvem", "vento", "estrela", "planeta", "lua", "rosa", "girassol",
      "terremoto", "tempestade", "trovão", "pedra", "areia", "sol", "mar", "flor", "árvore",
      "folha", "terra",
    ],
    medio: [
      "caverna", "pântano", "cerrado", "pantanal", "amazônia", "mangue", "geleira", "iceberg",
      "arco-íris", "relâmpago", "furacão", "tornado", "neblina", "granizo", "brisa", "aurora",
      "eclipse", "cometa", "meteoro", "galáxia", "orquídea", "margarida", "tulipa", "cacto",
      "samambaia", "bambu", "palmeira", "coqueiro", "pinheiro", "caatinga", "restinga", "várzea",
      "chapada", "pampa", "sertão", "agreste", "duna", "cajueiro", "mangueira", "bananeira",
    ],
    dificil: [
      "savana", "orvalho", "ipê", "jequitibá", "araucária", "baobá", "carvalho", "igarapé",
      "mata-atlântica", "pororoca", "vitória-régia", "pau-brasil", "seringueira", "buritizal",
      "paineira", "imbuia", "aroeira", "mandacaru", "xique-xique", "juazeiro", "manacá", "jacarandá",
      "braúna", "maçaranduba", "castanheira", "carnaúba", "babaçu", "palmito-juçara", "tabuleiro",
    ],
  },
  "🫀 Corpo humano": {
    facil: [
      "cabeça", "cabelo", "testa", "olho", "nariz", "boca", "dente", "língua", "orelha", "pescoço",
      "ombro", "braço", "mão", "dedo", "unha", "peito", "barriga", "umbigo", "costas", "cintura",
      "joelho", "coração", "sangue", "pele", "canela", "pé", "perna", "rosto", "corpo",
    ],
    medio: [
      "sobrancelha", "cílio", "lábio", "bochecha", "queixo", "cotovelo", "pulso", "quadril",
      "tornozelo", "calcanhar", "pulmão", "fígado", "rim", "estômago", "intestino", "cérebro",
      "esqueleto", "costela", "coluna", "músculo", "veia", "garganta", "bexiga", "axila", "nuca",
      "virilha", "tendão", "gengiva", "vesícula", "apêndice",
    ],
    dificil: [
      "artéria", "esôfago", "pâncreas", "baço", "clavícula", "fêmur", "tíbia", "rótula", "omoplata",
      "mandíbula", "úmero", "traqueia", "diafragma", "amígdala", "hipotálamo", "cerebelo", "duodeno",
      "esterno", "escápula", "laringe", "faringe", "córnea", "retina", "tímpano",
    ],
  },
  "🏫 Escola": {
    facil: [
      "caderno", "lápis", "caneta", "borracha", "mochila", "estojo", "quadro", "giz", "professor",
      "aluno", "recreio", "merenda", "prova", "trabalho", "lição", "matemática", "português",
      "história", "geografia", "ciências", "inglês", "artes", "cola", "tesoura", "mapa", "carteira",
      "uniforme", "régua",
    ],
    medio: [
      "apontador", "apagador", "diretor", "química", "física", "biologia", "redação", "dicionário",
      "biblioteca", "boletim", "matrícula", "formatura", "vestibular", "faculdade", "calculadora",
      "compasso", "agenda", "laboratório", "globo", "clipe", "enem", "tabuada", "ditado", "semestre",
      "mensalidade", "bimestre", "mestrado", "filosofia", "fundamental",
    ],
    dificil: [
      "transferidor", "fichário", "marca-texto", "grampeador", "paradidático", "monografia",
      "pós-graduação", "doutorado", "sociologia", "trigonometria", "logaritmo", "estequiometria",
      "semiótica", "histologia", "bacharelado", "licenciatura", "orientador", "pedagogia",
    ],
  },
  "🎭 Sentimento": {
    facil: [
      "alegria", "tristeza", "raiva", "medo", "amor", "saudade", "ciúme", "vergonha", "felicidade",
      "paixão", "coragem", "calma", "carinho", "culpa", "surpresa", "orgulho", "preguiça", "ódio",
      "dó", "pena",
    ],
    medio: [
      "inveja", "esperança", "ansiedade", "gratidão", "solidão", "tédio", "confiança",
      "desconfiança", "alívio", "angústia", "admiração", "mágoa", "apatia", "desespero", "vingança",
      "afeição", "devoção", "aperreio", "agonia",
    ],
    dificil: [
      "nostalgia", "euforia", "compaixão", "empatia", "ternura", "rancor", "remorso", "frustração",
      "entusiasmo", "serenidade", "banzo", "melancolia", "resiliência", "desalento", "perplexidade",
      "magnanimidade", "misantropia", "abnegação", "altruísmo", "sonolência", "desassossego",
    ],
  },
  "🎉 Festa e cultura": {
    facil: [
      "carnaval", "samba", "forró", "pagode", "funk", "natal", "páscoa", "fogueira", "churrasco",
      "casamento", "aniversário", "festa-junina", "são-joão", "bingo",
    ],
    medio: [
      "quadrilha", "quentão", "axé", "frevo", "ciranda", "baião", "sertanejo", "pisadinha",
      "arrocha", "brega", "lambada", "capoeira", "réveillon", "batizado", "formatura", "piquenique",
      "confete", "serpentina", "fantasia", "bloco", "panetone", "presépio", "abadá", "micareta",
      "vaquejada", "rodeio", "congada", "pau-de-sebo", "quermesse", "correio-elegante",
    ],
    dificil: [
      "maracatu", "bumba-meu-boi", "xote", "bossa-nova", "chorinho", "repente", "cordel",
      "trio-elétrico", "escola-de-samba", "reisado", "folia-de-reis", "afoxé", "carimbó", "siriri",
      "cavalhada", "tambor-de-crioula", "jongo", "marujada", "coco-de-roda", "sairé",
      "lavagem-do-bonfim", "círio-de-nazaré", "cururu", "boi-de-parintins", "vanerão", "xaxado",
    ],
  },
  "💬 Ditados e frases": {
    facil: [
      "quem-ama-cuida", "errar-é-humano", "tempo-é-dinheiro", "o-amor-é-cego", "quem-procura-acha",
      "quem-planta-colhe", "quem-avisa-amigo-é", "o-barato-sai-caro", "a-união-faz-a-força",
      "antes-tarde-do-que-nunca", "devagar-se-vai-ao-longe", "cada-macaco-no-seu-galho",
      "rir-é-o-melhor-remédio", "cão-que-ladra-não-morde", "onde-há-fumaça-há-fogo",
      "tudo-que-é-bom-dura-pouco", "quem-tem-boca-vai-a-roma", "filho-de-peixe-peixinho-é",
      "a-mentira-tem-perna-curta", "quem-espera-sempre-alcança", "é-dando-que-se-recebe",
      "o-peixe-morre-pela-boca", "roupa-suja-se-lava-em-casa",
    ],
    medio: [
      "a-pressa-é-inimiga-da-perfeição", "quem-não-arrisca-não-petisca",
      "em-boca-fechada-não-entra-mosca", "deus-ajuda-quem-cedo-madruga",
      "quem-canta-seus-males-espanta", "casa-de-ferreiro-espeto-de-pau",
      "quem-vê-cara-não-vê-coração", "santo-de-casa-não-faz-milagre",
      "o-seguro-morreu-de-velho", "amigos-amigos-negócios-à-parte", "o-hábito-não-faz-o-monge",
      "quando-um-não-quer-dois-não-brigam", "uma-andorinha-só-não-faz-verão",
      "depois-da-tempestade-vem-a-bonança", "cavalo-dado-não-se-olha-os-dentes",
      "gato-escaldado-tem-medo-de-água-fria", "há-males-que-vêm-para-o-bem",
      "não-há-bem-que-sempre-dure", "a-voz-do-povo-é-a-voz-de-deus",
      "quem-semeia-vento-colhe-tempestade", "a-galinha-do-vizinho-é-sempre-mais-gorda",
      "mais-vale-um-pássaro-na-mão-do-que-dois-voando", "para-bom-entendedor-meia-palavra-basta",
    ],
    dificil: [
      "de-grão-em-grão-a-galinha-enche-o-papo", "quem-com-ferro-fere-com-ferro-será-ferido",
      "macaco-velho-não-mete-a-mão-em-cumbuca", "pau-que-nasce-torto-nunca-se-endireita",
      "água-mole-em-pedra-dura-tanto-bate-até-que-fura",
      "quem-tem-telhado-de-vidro-não-joga-pedra-no-vizinho",
      "quem-nasceu-para-tostão-nunca-chega-a-milhão",
      "não-adianta-chorar-sobre-o-leite-derramado", "para-quem-sabe-ler-um-pingo-é-letra",
      "em-terra-de-cego-quem-tem-um-olho-é-rei", "quem-dá-aos-pobres-empresta-a-deus",
      "quem-não-tem-cão-caça-com-gato", "cachorro-mordido-de-cobra-tem-medo-de-linguiça",
      "farinha-pouca-meu-pirão-primeiro", "boi-sonso-é-que-arromba-a-cerca",
      "quem-come-e-guarda-come-duas-vezes", "a-corda-sempre-arrebenta-do-lado-mais-fraco",
      "é-melhor-prevenir-do-que-remediar", "bobeou-o-cachimbo-cai",
    ],
  },
  "🗣️ Gíria brasileira": {
    facil: [
      "mano", "cara", "top", "massa", "treta", "rolê", "zoeira", "moleque", "galera", "bora",
      "trampo", "grana", "busão", "mina", "parça", "valeu", "beleza", "firmeza", "fofoca", "balada",
      "partiu", "bagunça",
    ],
    medio: [
      "gambiarra", "perrengue", "cafuné", "xodó", "arretado", "oxente", "bagulho", "muvuca",
      "cabuloso", "mancada", "pirraça", "piá", "guri", "guria", "tchê", "uai", "caô", "vacilão",
      "mermão", "marmanjo", "bafafá", "furdunço", "forrobodó", "quebra-galho", "pão-duro",
      "mão-de-vaca", "dor-de-cotovelo", "puxa-saco", "cabra-macho", "barraco", "encrenca", "vixe",
      "eita", "bichim", "lasqueira", "baixaria", "boa-praça",
    ],
    dificil: [
      "mequetrefe", "borocoxô", "piripaque", "fuzuê", "chilique", "lero-lero", "ti-ti-ti",
      "bafo-de-onça", "sirigaita", "pé-rapado", "zé-ninguém", "pindaíba", "quiproquó", "rebuliço",
      "balacobaco", "supimpa", "batuta", "bambambã", "xexelento", "muquirana", "bodega", "capiongo",
      "cacareco", "quinquilharia", "estrupício", "tranqueira", "cafundó", "ziriguidum",
      "cafundó-do-judas", "onde-judas-perdeu-as-botas", "sebo-nas-canelas", "bicho-grilo",
      "aperrear", "arrudeio", "mangar", "abestado", "fuleiro",
    ],
  },
  "🧚 Folclore": {
    facil: [
      "saci", "iara", "cuca", "lobisomem", "boto", "bicho-papão", "fantasma", "assombração",
      "sereia", "bruxa",
    ],
    medio: [
      "curupira", "caipora", "boitatá", "mula-sem-cabeça", "saci-pererê", "boto-cor-de-rosa",
      "homem-do-saco", "loira-do-banheiro", "mãe-do-ouro", "chupa-cabra",
    ],
    dificil: [
      "negrinho-do-pastoreio", "cabeça-de-cuia", "matinta-pereira", "boiúna", "capelobo",
      "corpo-seco", "comadre-fulozinha", "jurupari", "ipupiara", "anhangá", "mapinguari", "pisadeira",
      "papa-figo", "alamoa", "cobra-norato", "pé-de-garrafa", "tutu-marambá",
    ],
  },
  "🗺️ Estado brasileiro": {
    facil: [
      "bahia", "ceará", "goiás", "paraná", "pará", "acre", "amapá", "minas-gerais", "são-paulo",
      "rio-de-janeiro",
    ],
    medio: [
      "pernambuco", "maranhão", "alagoas", "sergipe", "piauí", "amazonas", "roraima", "rondônia",
      "tocantins", "espírito-santo", "santa-catarina", "paraíba",
    ],
    dificil: [
      "mato-grosso", "mato-grosso-do-sul", "rio-grande-do-sul", "rio-grande-do-norte",
      "distrito-federal",
    ],
  },
  "📚 Vocabulário": {
    facil: [
      "amizade", "caminho", "janela", "verdade", "segredo", "futuro", "palavra", "família",
      "domingo", "vizinho", "sorriso", "cidade", "viagem", "mistério", "aventura", "tesouro",
      "liberdade", "música", "lembrança", "abraço",
    ],
    medio: [
      "paciência", "sabedoria", "gentileza", "generosidade", "responsabilidade", "honestidade",
      "curiosidade", "imaginação", "conhecimento", "oportunidade", "experiência", "consequência",
      "perseverança", "desenvolvimento", "independência", "sustentabilidade", "democracia",
      "constituição", "cidadania",
    ],
    dificil: [
      "idiossincrasia", "paralelepípedo", "inconstitucionalissimamente",
      "anticonstitucionalissimamente", "pneumoultramicroscopicossilicovulcanoconiótico", "quimera",
      "efêmero", "idílico", "inefável", "prolegômenos", "sesquipedal", "ambivalência", "dicotomia",
      "paradigma", "hermenêutica", "ubiquidade", "quintessência", "peremptório", "inexorável",
      "procrastinação", "verossimilhança", "beneplácito", "circunspecto", "concupiscência",
      "obnubilação", "vicissitude", "perspicácia", "jactância", "mesóclise", "onomatopeia",
      "proparoxítona", "pleonasmo", "eufemismo", "hipérbole", "metonímia", "anacoluto",
    ],
  },
};

export const HANGMAN_CATEGORIES = Object.keys(HANGMAN_WORDS);
