import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ClipboardCopy, Wand2, Settings2, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Upload, X, FileText, Image as ImageIcon, SlidersHorizontal, Wrench, ShoppingCart, RotateCcw, Trash2 } from 'lucide-react';

// This would be configured in a real environment, likely via environment variables.
const apiKey = process.env.GEMINI_API_KEY;

const COLUMNS_SC = [
  { id: 'sta', label: 'Sta.' },
  { id: 'itemNum', label: 'Item' },
  { id: 'c', label: 'C' },
  { id: 'i', label: 'I' },
  { id: 'material', label: 'Material' },
  { id: 'textoBreve', label: 'Texto breve' },
  { id: 'quantidade', label: 'Quant.' },
  { id: 'um', label: 'UM' },
  { id: 'preco', label: 'Preço av.' },
  { id: 't', label: 'T' },
  { id: 'dtRemessa', label: 'Dt.remessa' },
  { id: 'grpMercads', label: 'GrpMercads.' },
  { id: 'centro', label: 'Centro' },
  { id: 'deposito', label: 'Depósito' },
  { id: 'gc', label: 'GC...' },
  { id: 'requisitante', label: 'Requisitante' }
];

const COLUMNS_OS = [
  { id: 'itemNum', label: 'Item' },
  { id: 'componente', label: 'Componente' },
  { id: 'denominacao', label: 'Denominação' },
  { id: 'tItem', label: 'T...' },
  { id: 'qtdNecess', label: 'Qtd.necess.' },
  { id: 'um', label: 'UM' },
  { id: 'ti', label: 'TI' },
  { id: 'e', label: 'E..' },
  { id: 'dep', label: 'Dep.' },
  { id: 'cen', label: 'Cen.' },
  { id: 'oper', label: 'Oper' },
  { id: 'lote', label: 'Lote' },
  { id: 'ctgSuprimento', label: 'Ctg.suprimento' },
  { id: 'recebedor', label: 'Recebedor' },
  { id: 'ptoDescarga', label: 'Pto.descarga' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('sc'); // 'sc' (Solicitação de Compra) ou 'os' (Ordem de Serviço)
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [rawAiData, setRawAiData] = useState([]); // Guarda os dados brutos da IA para permitir troca de abas sem recarregar
  const [tableData, setTableData] = useState([]);
  
  const [files, setFiles] = useState([]);
  const [showCopyConfig, setShowCopyConfig] = useState(false);
  
  // Novo estado para o Sistema Inteligente de Lotes
  const [copiedCount, setCopiedCount] = useState(0);

  // Configurações predefinidas
  const [config, setConfig] = useState({
    centro: '0100',
    gc: '107',
    requisitante: 'Thiago Lima',
    dtRemessa: '',
    codigoC: 'K',
    materialBase: 'Reposi', 
    preco: '1,00',
    loteTamanho: 10 // Padrão de linhas por lote para cópia no SAP
  });

  // Estado para controlar quais colunas serão copiadas
  const [copyColumnsSC, setCopyColumnsSC] = useState(
    COLUMNS_SC.reduce((acc, col) => ({ ...acc, [col.id]: col.id !== 'sta' && col.id !== 'itemNum' }), {})
  );
  const [copyColumnsOS, setCopyColumnsOS] = useState(
    COLUMNS_OS.reduce((acc, col) => ({ ...acc, [col.id]: col.id !== 'itemNum' && col.id !== 'tItem' }), {})
  );

  // Configura a data de amanhã + 14 dias como padrão inicial
  useEffect(() => {
    const data = new Date();
    data.setDate(data.getDate() + 14);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    setConfig(prev => ({ ...prev, dtRemessa: `${dia}.${mes}.${ano}` }));
  }, []);

  // Reconstrói a tabela e reseta o lote de cópias sempre que mudar de aba ou receber novos dados brutos
  useEffect(() => {
    buildTableData(rawAiData, activeTab);
    setCopiedCount(0);
  }, [activeTab, rawAiData]);

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setInputText('');
    setFiles([]);
    setTableData([]);
    setRawAiData([]);
    setCopiedCount(0);
    setError(null);
    setSuccessMsg('Dados limpos! Pronto para nova análise.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve({
      inlineData: {
        data: reader.result.split(',')[1],
        mimeType: file.type
      }
    });
    reader.onerror = error => reject(error);
  });

  const handleCellChange = (index, field, value) => {
    setTableData(prevData => prevData.map((row, i) => {
      if (i === index) {
        const updatedRow = { ...row, [field]: value };
        
        if (activeTab === 'sc' && field === 'um') {
          const isPar = String(value).toUpperCase() === 'PAR';
          updatedRow.material = isPar ? `${config.materialBase}(PAR)` : `${config.materialBase}(UN)`;
        }
        
        return updatedRow;
      }
      return row;
    }));
  };

  const toggleCopyColumn = (colId) => {
    if (activeTab === 'sc') {
      setCopyColumnsSC(prev => ({ ...prev, [colId]: !prev[colId] }));
    } else {
      setCopyColumnsOS(prev => ({ ...prev, [colId]: !prev[colId] }));
    }
  };

  const buildTableData = (items, tab) => {
    if (!items || items.length === 0) {
      setTableData([]);
      return;
    }

    if (tab === 'sc') {
      const generatedTable = items.map((item, idx) => {
        const isPar = (item.unidade || '').toUpperCase() === 'PAR';
        return {
          sta: '🔴',
          itemNum: ((idx + 1) * 10).toString(),
          c: config.codigoC || '',
          i: '',
          material: isPar ? `${config.materialBase}(PAR)` : `${config.materialBase}(UN)`,
          textoBreve: item.descricao || '',
          quantidade: item.quantidade !== undefined ? item.quantidade.toString() : '',
          um: (item.unidade || '').toUpperCase(),
          preco: config.preco || '',
          t: 'D',
          dtRemessa: config.dtRemessa || '',
          grpMercads: '',
          centro: config.centro || '',
          deposito: '',
          gc: config.gc || '',
          requisitante: config.requisitante || '',
        };
      });
      setTableData(generatedTable);
    } else if (tab === 'os') {
      const generatedTable = items.map((item, idx) => {
        return {
          itemNum: String((idx + 1) * 10).padStart(4, '0'),
          componente: '',
          denominacao: item.descricao || '',
          tItem: '',
          qtdNecess: item.quantidade !== undefined ? item.quantidade.toString() : '',
          um: (item.unidade || '').toUpperCase(),
          ti: '',
          e: '',
          dep: '',
          cen: '',
          oper: '',
          lote: '',
          ctgSuprimento: '',
          recebedor: config.requisitante || '',
          ptoDescarga: ''
        };
      });
      setTableData(generatedTable);
    }
  };

  const processWithAI = async () => {
    if (!apiKey) {
      setError('A chave da API Gemini não foi encontrada. Por favor, configure-a no painel de Segredos (Secrets) do AI Studio para usar o aplicativo.');
      setIsProcessing(false);
      return;
    }

    if (!inputText.trim() && files.length === 0) {
      setError('Por favor, cole algum texto ou anexe um ficheiro/foto com a lista de materiais.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMsg('');

    const systemPrompt = `Você é um assistente de Backoffice ERP (SAP) que retorna APENAS um objeto JSON.
    Analise o texto e/ou imagens e extraia a lista de itens.
    Sua resposta DEVE ser um objeto JSON com uma única chave "materiais", que é um array de objetos.
    Cada objeto no array deve ter as chaves "descricao" (string, MAIÚSCULAS), "quantidade" (number), e "unidade" (string, sigla SAP).
    Exemplo de formato de saída: {"materiais": [{"descricao": "ITEM EXEMPLO", "quantidade": 1, "unidade": "UN"}]}
    
    REGRAS PARA UNIDADE DE MEDIDA (UM):
    1. Se o documento original (texto ou imagem) já indicar a unidade (ex: "PC", "peças", "UN", "unidades", "PAR", "pares", "M", "metros", "LT", "litros"), VOCÊ DEVE OBEDECER E USAR A UNIDADE INFORMADA.
    2. Formate a saída estritamente com as siglas oficiais do SAP: 'PC' (Peça), 'UN' (Unidade), 'PAR' (Par), 'M' (Metro), 'CX' (Caixa), 'KG' (Quilo), 'LT' (Litro).
    3. Use a dedução apenas se o item não possuir absolutamente NENHUMA indicação de unidade no texto/imagem original.`;

    const parts = [];
    if (inputText.trim()) {
      parts.push({ text: inputText });
    }
    
    try {
      for (const file of files) {
        const base64Data = await fileToBase64(file);
        parts.push(base64Data);
      }
    } catch (err) {
      setError('Erro ao ler os ficheiros anexados.');
      setIsProcessing(false);
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const payload = {
        model: 'gemini-1.5-flash-latest',
        contents: [{ parts: parts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    console.log("Enviando para API:", JSON.stringify(payload, null, 2));

    let attempt = 0;
    const maxRetries = 5;
    const delays = [1000, 2000, 4000, 8000, 16000];
    let apiSuccess = false;
    let jsonResult = null;

    while (attempt < maxRetries && !apiSuccess) {
      try {
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [{ parts: parts }],
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json"
            }
        });
        
        let textResponse = result.text;
        
        if (textResponse) {
          // Sanitize the response to remove markdown fences and trim whitespace
          const jsonMatch = textResponse.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch && jsonMatch[1]) {
            textResponse = jsonMatch[1];
          }
          textResponse = textResponse.trim();

          jsonResult = JSON.parse(textResponse);
          apiSuccess = true;
        } else {
          throw new Error('Resposta vazia da IA.');
        }
      } catch (err) {
        console.error("API Error:", err); // Log for debugging
        attempt++;
        if (attempt >= maxRetries) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          let userFriendlyError = `Falha na API: ${errorMessage}`;

          if (errorMessage.includes('API key not valid')) {
            userFriendlyError = 'Sua chave de API não é válida. Verifique se a chave está correta no painel de Segredos (Secrets) e tente novamente.';
          } else if (errorMessage.includes('permission')) {
            userFriendlyError = 'Permissão negada. Sua chave de API pode não ter acesso a este modelo de IA. Verifique as configurações no Google AI Studio.';
          }

          setError(userFriendlyError);
          setIsProcessing(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
      }
    }

    if (apiSuccess && jsonResult && jsonResult.materiais) {
      setRawAiData(jsonResult.materiais); // Salva os dados brutos
      setSuccessMsg(`Tabela gerada para ${activeTab === 'sc' ? 'Solicitação de Compra' : 'Ordem de Serviço'}!`);
    }
    
    setIsProcessing(false);

  };

  const copyBatchToClipboard = () => {
    if (tableData.length === 0) return;

    const batchSize = Number(config.loteTamanho) || 10;
    const currentBatch = tableData.slice(copiedCount, copiedCount + batchSize);

    if (currentBatch.length === 0) return;

    let tsvData;

    if (activeTab === 'sc') {
      tsvData = currentBatch.map(row => {
        const rowData = [];
        if (copyColumnsSC.sta) rowData.push(String(row.sta || '').trim());
        if (copyColumnsSC.itemNum) rowData.push(String(row.itemNum || '').trim());
        
        rowData.push(copyColumnsSC.c ? String(row.c || '').trim() : '');
        rowData.push(copyColumnsSC.i ? String(row.i || '').trim() : '');
        rowData.push(copyColumnsSC.material ? String(row.material || '').trim() : '');
        rowData.push(copyColumnsSC.textoBreve ? String(row.textoBreve || '').trim() : '');
        rowData.push(copyColumnsSC.quantidade ? String(row.quantidade || '').trim() : '');
        rowData.push(copyColumnsSC.um ? String(row.um || '').trim() : '');
        rowData.push(copyColumnsSC.preco ? String(row.preco || '').trim() : '');
        rowData.push(copyColumnsSC.t ? String(row.t || '').trim() : '');
        rowData.push(copyColumnsSC.dtRemessa ? String(row.dtRemessa || '').trim() : '');
        rowData.push(copyColumnsSC.grpMercads ? String(row.grpMercads || '').trim() : '');
        rowData.push(copyColumnsSC.centro ? String(row.centro || '').trim() : '');
        rowData.push(copyColumnsSC.deposito ? String(row.deposito || '').trim() : '');
        rowData.push(copyColumnsSC.gc ? String(row.gc || '').trim() : '');
        rowData.push(copyColumnsSC.requisitante ? String(row.requisitante || '').trim() : '');
        
        return rowData.join('\t');
      });
    } else {
      tsvData = currentBatch.map(row => {
        const rowData = [];
        if (copyColumnsOS.itemNum) rowData.push(String(row.itemNum || '').trim());
        
        rowData.push(copyColumnsOS.componente ? String(row.componente || '').trim() : '');
        rowData.push(copyColumnsOS.denominacao ? String(row.denominacao || '').trim() : '');
        
        if (copyColumnsOS.tItem) rowData.push(String(row.tItem || '').trim());
        
        rowData.push(copyColumnsOS.qtdNecess ? String(row.qtdNecess || '').trim() : '');
        rowData.push(copyColumnsOS.um ? String(row.um || '').trim() : '');
        rowData.push(copyColumnsOS.ti ? String(row.ti || '').trim() : '');
        rowData.push(copyColumnsOS.e ? String(row.e || '').trim() : '');
        rowData.push(copyColumnsOS.dep ? String(row.dep || '').trim() : '');
        rowData.push(copyColumnsOS.cen ? String(row.cen || '').trim() : '');
        rowData.push(copyColumnsOS.oper ? String(row.oper || '').trim() : '');
        rowData.push(copyColumnsOS.lote ? String(row.lote || '').trim() : '');
        rowData.push(copyColumnsOS.ctgSuprimento ? String(row.ctgSuprimento || '').trim() : '');
        rowData.push(copyColumnsOS.recebedor ? String(row.recebedor || '').trim() : '');
        rowData.push(copyColumnsOS.ptoDescarga ? String(row.ptoDescarga || '').trim() : '');
        
        return rowData.join('\t');
      });
    }

    const finalString = tsvData.join('\n');

    const textarea = document.createElement('textarea');
    textarea.value = finalString;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      
      const newlyCopiedCount = copiedCount + currentBatch.length;
      setCopiedCount(newlyCopiedCount);
      
      if (newlyCopiedCount >= tableData.length) {
         setSuccessMsg('✅ Todas as linhas foram copiadas com sucesso!');
      } else {
         setSuccessMsg(`Lote copiado! Vá ao SAP, faça Ctrl+V, prima [ENTER] para abrir novas linhas, e volte aqui.`);
      }
      
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      setError('Falha ao copiar. O seu navegador pode não suportar esta ação.');
    }
    document.body.removeChild(textarea);
  };

  const currentColsDef = activeTab === 'sc' ? COLUMNS_SC : COLUMNS_OS;
  const currentCopyColumns = activeTab === 'sc' ? copyColumnsSC : copyColumnsOS;

  const batchSize = Number(config.loteTamanho) || 10;
  const hasMoreToCopy = tableData.length > 0 && copiedCount < tableData.length;
  const nextBatchEnd = Math.min(copiedCount + batchSize, tableData.length);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        <header className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-lg text-white">
              <FileSpreadsheet size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">SAP Smart Input</h1>
              <p className="text-slate-500 text-sm">Geração de tabelas inteligentes para MM e PM.</p>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto">
            <button 
              onClick={() => setActiveTab('sc')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'sc' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'}`}
            >
              <ShoppingCart size={16} /> Solicitação de Compra
            </button>
            <button 
              onClick={() => setActiveTab('os')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'os' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'}`}
            >
              <Wrench size={16} /> Ordem de Serviço
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          <div className="xl:col-span-1 space-y-6">
            
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Settings2 size={20} className="text-slate-500" />
                Valores Padrão Globais
              </h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Requisitante/Recebedor Padrão</label>
                    <input type="text" name="requisitante" value={config.requisitante ?? ''} onChange={handleConfigChange} className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-blue-600 mb-1" title="Número de linhas que o SAP consegue ver no seu ecrã sem fazer scroll.">Lote de Cópia Inteligente (SAP)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="1" max="50" name="loteTamanho" value={config.loteTamanho ?? ''} onChange={handleConfigChange} className="w-20 text-sm p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50" />
                      <span className="text-xs text-slate-500">linhas por clique</span>
                    </div>
                  </div>

                  {activeTab === 'sc' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Centro</label>
                        <input type="text" name="centro" value={config.centro ?? ''} onChange={handleConfigChange} className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Grp Compras (GC)</label>
                        <input type="text" name="gc" value={config.gc ?? ''} onChange={handleConfigChange} className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Coluna C</label>
                        <input type="text" name="codigoC" value={config.codigoC ?? ''} onChange={handleConfigChange} className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1" title="Prefixo Base do Material">Material Base</label>
                        <input type="text" name="materialBase" value={config.materialBase ?? ''} onChange={handleConfigChange} className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Preço Inicial</label>
                        <input type="text" name="preco" value={config.preco ?? ''} onChange={handleConfigChange} className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Data Remessa</label>
                        <input type="text" name="dtRemessa" value={config.dtRemessa ?? ''} onChange={handleConfigChange} placeholder="DD.MM.AAAA" className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-auto">
              <h2 className="text-lg font-semibold mb-2">Entrada de Dados</h2>
              <p className="text-xs text-slate-500 mb-4">A IA lerá os itens e organizará as colunas para a {activeTab === 'sc' ? 'Solicitação' : 'Ordem de Serviço'}.</p>
              
              <textarea 
                className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none mb-3 min-h-[120px]"
                placeholder="Cole o texto aqui..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 mb-4 bg-slate-50 flex flex-col items-center justify-center relative hover:bg-slate-100 transition-colors">
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  multiple 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Clique para anexar ficheiros"
                />
                <Upload size={24} className="text-slate-400 mb-2" />
                <span className="text-sm font-medium text-slate-600">Clique para anexar Fotos ou PDF</span>
              </div>

              {files.length > 0 && (
                <div className="mb-4 space-y-2 max-h-32 overflow-y-auto pr-1">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-100 text-sm">
                      <div className="flex items-center gap-2 text-blue-800 overflow-hidden">
                        {file.type.includes('pdf') ? <FileText size={16} className="shrink-0" /> : <ImageIcon size={16} className="shrink-0" />}
                        <span className="truncate max-w-[150px]" title={file.name}>{file.name}</span>
                      </div>
                      <button onClick={() => removeFile(idx)} className="text-blue-400 hover:text-red-500 transition-colors shrink-0 p-1">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 w-full mt-auto">
                <button 
                  onClick={clearAll}
                  disabled={isProcessing || (!inputText && files.length === 0 && tableData.length === 0)}
                  className="py-3 px-4 bg-slate-100 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-600 font-medium rounded-lg flex justify-center items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Limpar tudo e iniciar nova análise"
                >
                  <Trash2 size={20} />
                </button>
                <button 
                  onClick={processWithAI}
                  disabled={isProcessing}
                  className="flex-grow py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex justify-center items-center gap-2 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} />}
                  {isProcessing ? 'Analisando com IA...' : 'Gerar Tabela'}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 text-red-700 text-sm items-start">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            {successMsg && !isProcessing && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3 text-green-700 text-sm items-start">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <p>{successMsg}</p>
              </div>
            )}

          </div>

          <div className="xl:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[800px] overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  Visualização: <span className="text-blue-600 bg-blue-100 px-2 py-0.5 rounded text-sm">{activeTab === 'sc' ? 'Solicitação de Compra' : 'Ordem de Serviço (IW32)'}</span>
                </h2>
                
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={() => setShowCopyConfig(!showCopyConfig)}
                    className="px-3 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <SlidersHorizontal size={16} /> Colunas
                  </button>
                  
                  {tableData.length > 0 && copiedCount > 0 && (
                     <button 
                       onClick={() => setCopiedCount(0)}
                       className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                       title="Recomeçar a cópia desde a primeira linha"
                     >
                       <RotateCcw size={16} /> Recomeçar
                     </button>
                  )}

                  <button 
                    onClick={copyBatchToClipboard}
                    disabled={!hasMoreToCopy || tableData.length === 0}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors disabled:bg-emerald-600 disabled:opacity-100 disabled:cursor-not-allowed shadow-sm min-w-[200px] justify-center"
                  >
                    {hasMoreToCopy ? (
                      <>
                        <ClipboardCopy size={16} />
                        Copiar Lote ({copiedCount + 1} a {nextBatchEnd})
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Todos os lotes copiados
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {showCopyConfig && (
                <div className="p-4 bg-white border border-blue-200 rounded-lg shadow-inner">
                  <p className="text-sm font-medium text-slate-700 mb-3">Selecione as colunas que deseja copiar para o SAP ({activeTab === 'sc' ? 'Solicitação' : 'Ordem de Serviço'}):</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {currentColsDef.map(col => (
                      <label key={col.id} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                        <input
                          type="checkbox"
                          checked={currentCopyColumns[col.id]}
                          onChange={() => toggleCopyColumn(col.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 p-2 bg-blue-50 text-blue-800 text-xs rounded border border-blue-200">
                    <strong>Sistema Grid-Lock Ativo:</strong> Desmarcar as colunas do meio não as remove da cópia, apenas limpa o seu valor. Isto assegura que todas as colunas ficam perfeitamente alinhadas quando fizer colar (Ctrl+V) no SAP! 
                  </div>
                  
                  {tableData.length > batchSize && (
                    <div className="mt-3 p-3 bg-indigo-50 text-indigo-800 text-xs rounded border border-indigo-200 shadow-sm">
                      <strong className="text-indigo-900 text-sm flex items-center gap-1 mb-1">
                        <span className="text-lg">💡</span> O Segredo dos Lotes no SAP
                      </strong>
                      <p className="mb-2">Como tem mais de {batchSize} itens, siga esta sequência:</p>
                      <ol className="list-decimal ml-5 space-y-1.5 font-medium">
                        <li>Copie o 1º Lote aqui.</li>
                        <li>Cole no SAP e <strong className="bg-indigo-200 px-1 rounded">prima [ENTER] no seu teclado</strong>. O SAP vai validar e revelar novas linhas em branco por baixo.</li>
                        <li>Volte aqui e copie o 2º Lote.</li>
                        <li>No SAP, clique na nova primeira linha vazia que apareceu e cole novamente!</li>
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex-grow overflow-auto bg-white p-0">
              {tableData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <FileSpreadsheet size={48} className="mb-4 opacity-20" />
                  <p>A tabela gerada aparecerá aqui.</p>
                  <p className="text-xs mt-2">Dica: Pode trocar de separador após a leitura para ver os dados no outro formato.</p>
                </div>
              ) : (
                <div className="inline-block min-w-full align-middle pb-20">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm outline outline-1 outline-slate-200">
                      <tr>
                        {currentColsDef.map((h, i) => (
                          <th key={i} scope="col" className={`px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-0 ${!currentCopyColumns[h.id] ? 'opacity-40 bg-slate-100' : ''}`} title={!currentCopyColumns[h.id] ? "Esta coluna vai ser enviada em branco para o SAP" : ""}>
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {activeTab === 'sc' && tableData.map((row, idx) => {
                        const isCopied = idx < copiedCount;
                        return (
                        <tr key={idx} className={`transition-colors group ${isCopied ? 'bg-emerald-50/70 opacity-60' : 'hover:bg-blue-50'}`}>
                          <td className={`px-3 py-1 whitespace-nowrap text-center ${!currentCopyColumns.sta ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.sta ?? ''} onChange={(e) => handleCellChange(idx, 'sta', e.target.value)} className="w-6 text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap font-medium ${!currentCopyColumns.itemNum ? 'opacity-40' : ''}`}>
                            <div className="flex items-center">
                              {isCopied && <CheckCircle2 size={12} className="inline mr-1 text-emerald-600 shrink-0" />}
                              <input type="text" value={row.itemNum ?? ''} onChange={(e) => handleCellChange(idx, 'itemNum', e.target.value)} className="w-10 bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                            </div>
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.c ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.c ?? ''} onChange={(e) => handleCellChange(idx, 'c', e.target.value)} className="w-6 text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.i ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.i ?? ''} onChange={(e) => handleCellChange(idx, 'i', e.target.value)} className="w-6 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.material ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.material ?? ''} onChange={(e) => handleCellChange(idx, 'material', e.target.value)} className={`w-28 bg-transparent font-mono border-b border-transparent hover:border-blue-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors ${isCopied ? 'text-emerald-800' : 'text-blue-700'}`} />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.textoBreve ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.textoBreve ?? ''} onChange={(e) => handleCellChange(idx, 'textoBreve', e.target.value)} className={`w-full min-w-[250px] bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors ${isCopied ? 'text-emerald-900' : 'text-slate-900'}`} title={row.textoBreve} />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.quantidade ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.quantidade ?? ''} onChange={(e) => handleCellChange(idx, 'quantidade', e.target.value)} className="w-16 bg-transparent text-right font-semibold border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.um ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.um ?? ''} onChange={(e) => handleCellChange(idx, 'um', e.target.value)} className="w-12 bg-transparent font-mono uppercase border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.preco ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.preco ?? ''} onChange={(e) => handleCellChange(idx, 'preco', e.target.value)} className="w-16 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.t ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.t ?? ''} onChange={(e) => handleCellChange(idx, 't', e.target.value)} className="w-6 text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.dtRemessa ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.dtRemessa ?? ''} onChange={(e) => handleCellChange(idx, 'dtRemessa', e.target.value)} className="w-20 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.grpMercads ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.grpMercads ?? ''} onChange={(e) => handleCellChange(idx, 'grpMercads', e.target.value)} className="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap font-mono ${!currentCopyColumns.centro ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.centro ?? ''} onChange={(e) => handleCellChange(idx, 'centro', e.target.value)} className="w-12 font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.deposito ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.deposito ?? ''} onChange={(e) => handleCellChange(idx, 'deposito', e.target.value)} className="w-12 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.gc ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.gc ?? ''} onChange={(e) => handleCellChange(idx, 'gc', e.target.value)} className="w-10 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.requisitante ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.requisitante ?? ''} onChange={(e) => handleCellChange(idx, 'requisitante', e.target.value)} className="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                        </tr>
                      )})
                      }

                      {activeTab === 'os' && tableData.map((row, idx) => {
                        const isCopied = idx < copiedCount;
                        return (
                        <tr key={idx} className={`transition-colors group ${isCopied ? 'bg-emerald-50/70 opacity-60' : 'hover:bg-blue-50'}`}>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.itemNum ? 'opacity-40' : ''}`}>
                            <div className="flex items-center">
                              {isCopied && <CheckCircle2 size={12} className="inline mr-1 text-emerald-600 shrink-0" />}
                              <input type="text" value={row.itemNum ?? ''} onChange={(e) => handleCellChange(idx, 'itemNum', e.target.value)} className="w-12 bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                            </div>
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.componente ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.componente ?? ''} onChange={(e) => handleCellChange(idx, 'componente', e.target.value)} className="w-20 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.denominacao ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.denominacao ?? ''} onChange={(e) => handleCellChange(idx, 'denominacao', e.target.value)} className={`w-full min-w-[300px] bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors ${isCopied ? 'text-emerald-900' : 'text-slate-900'}`} title={row.denominacao} />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.tItem ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.tItem ?? ''} onChange={(e) => handleCellChange(idx, 'tItem', e.target.value)} className="w-12 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.qtdNecess ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.qtdNecess ?? ''} onChange={(e) => handleCellChange(idx, 'qtdNecess', e.target.value)} className="w-20 bg-transparent text-right font-semibold border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.um ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.um ?? ''} onChange={(e) => handleCellChange(idx, 'um', e.target.value)} className="w-12 bg-transparent font-mono uppercase border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.ti ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.ti ?? ''} onChange={(e) => handleCellChange(idx, 'ti', e.target.value)} className="w-12 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.e ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.e ?? ''} onChange={(e) => handleCellChange(idx, 'e', e.target.value)} className="w-12 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.dep ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.dep ?? ''} onChange={(e) => handleCellChange(idx, 'dep', e.target.value)} className="w-16 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.cen ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.cen ?? ''} onChange={(e) => handleCellChange(idx, 'cen', e.target.value)} className="w-16 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.oper ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.oper ?? ''} onChange={(e) => handleCellChange(idx, 'oper', e.target.value)} className="w-16 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.lote ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.lote ?? ''} onChange={(e) => handleCellChange(idx, 'lote', e.target.value)} className="w-16 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.ctgSuprimento ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.ctgSuprimento ?? ''} onChange={(e) => handleCellChange(idx, 'ctgSuprimento', e.target.value)} className="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.recebedor ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.recebedor ?? ''} onChange={(e) => handleCellChange(idx, 'recebedor', e.target.value)} className="w-32 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                          <td className={`px-3 py-1 whitespace-nowrap ${!currentCopyColumns.ptoDescarga ? 'opacity-40' : ''}`}>
                            <input type="text" value={row.ptoDescarga ?? ''} onChange={(e) => handleCellChange(idx, 'ptoDescarga', e.target.value)} className="w-32 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-1 py-1 transition-colors" />
                          </td>
                        </tr>
                      )})
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
