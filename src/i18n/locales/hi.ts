export default {
  tagline: 'विकास के लिए एक फेंकने-योग्य Signum चेन। तोड़ें, रीसेट करें, फिर से शुरू करें।',
  status: { live: 'लाइव', polling: 'पोलिंग', offline: 'ऑफ़लाइन', scanning: 'स्कैन जारी' },
  panel: { nodeState: 'नोड स्थिति' },
  tile: { height: 'ब्लॉक ऊँचाई', lastBlock: 'अंतिम ब्लॉक' },
  entry: {
    apiDocs: { title: 'API दस्तावेज़', description: 'पूरे JSON API को इंटरैक्टिव रूप से आज़माएँ' },
    dashboard: { title: 'मॉक नोड डैशबोर्ड', description: 'ब्लॉक बनाएँ, खाते और लेनदेन देखें' },
    comingSoon: 'जल्द आ रहा है',
  },
  unreachable: { title: '{{host}} पर कोई नोड नहीं', description: 'इसे ./scripts/start.sh से शुरू करें' },
} as const
