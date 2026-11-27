import { tratarMensagem, type RespostaBackup } from './gravadorBackup';

chrome.runtime.onMessage.addListener(
  (mensagem: unknown, remetente, responder: (r: RespostaBackup) => void) => {
    void tratarMensagem(mensagem, remetente, chrome.runtime.id, chrome.downloads).then(responder);
    return true;
  },
);
