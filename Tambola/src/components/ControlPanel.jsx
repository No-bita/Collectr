import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { DEFAULT_THEMES } from '../utils/tambolaEngine';

const TRANSLATIONS = {
  en: {
    configTitle: 'Configurator',
    configSub: 'Configure theme rules, item names and ticket layout.',
    customTitleLabel: 'Title',
    themeLabel: 'Items',
    languageLabel: 'Language',
    ticketStyleLabel: 'Ticket Design',
    ticketsCountLabel: 'No. of Tickets',
    ticketsPerPageLabel: 'Per Page',
    rowsCountLabel: 'Rows',
    columnsCountLabel: 'Columns',
    itemsPerRowLabel: 'Items per Row',
    itemListHeader: 'Item List',
    addItemManual: '✍️ Add Manually',
    addItemBulk: '📋 Bulk Import',
    resetButton: 'Reset',
    searchPlaceholder: '🔍 Search items...',
    generateButton: '✨ Generate Tambola Tickets',
    needsItemsWarning: (count) => `You need at least ${count} items in the list to generate tickets.`,
    themeFood: '🍕 Food Fiesta',
    themeKitty: '💄 Kitty Party',
    themeCustom: '✨ Create new',
    skinRoyalGold: '👑 Royal Gold',
    skinNeonParty: '⚡ Neon Party',
    skinFreshMint: '🍃 Fresh Mint',
    skinClassicRetro: '📜 Classic Retro',
    skinFloralQueen: '🌸 Floral Queen',
    skinFloralGarden: '🌸 Floral Garden',
    itemsStatus: (count, needed) => `${count} Items (${count >= needed ? 'Valid' : `Needs ${needed}`})`,
    importBtn: (count) => `Import ${count} Items`,
    bulkPlaceholder: 'Paste items separated by commas or lines, e.g.:\nDosa, Jalebi, Samosa, Dhokla',
    labelEmoji: 'Emoji',
    labelNameEn: 'Name (English)',
    labelNameHi: 'Hindi (optional)',
    labelNameGu: 'Gujarati (optional)',
    noItemsMatch: 'No items matched search.',
    addWarningSuffix: (needed, current) => ` Add ${needed - current} more!`,
    uploadTheme: '📂 Upload',
    uploadInvalid: 'Invalid JSON format. Must contain a "name" object and an "items" array.',
    uploadDesign: '📂 Upload',
    uploadDesignInvalid: 'Invalid file format. Please upload a valid PNG, JPG, or JPEG image.'
  },
  hi: {
    configTitle: 'कॉन्फ़िगरेशन',
    configSub: 'थीम नियम, आइटम नाम और टिकट लेआउट सेट करें।',
    customTitleLabel: 'शीर्षक',
    themeLabel: 'आइटम',
    languageLabel: 'भाषा',
    ticketStyleLabel: 'टिकट डिज़ाइन',
    ticketsCountLabel: 'टिकट संख्या',
    ticketsPerPageLabel: 'प्रति पृष्ठ',
    rowsCountLabel: 'पंक्तियाँ',
    columnsCountLabel: 'कॉलम',
    itemsPerRowLabel: 'प्रति पंक्ति आइटम',
    itemListHeader: 'आइटम सूची',
    addItemManual: '✍️ मैन्युअल जोड़ें',
    addItemBulk: '📋 थोक आयात',
    resetButton: 'रीसेट',
    searchPlaceholder: '🔍 आइटम खोजें...',
    generateButton: '✨ तंबोला टिकट जनरेट करें',
    needsItemsWarning: (count) => `टिकट बनाने के लिए आपको सूची में कम से कम ${count} आइटम चाहिए।`,
    themeFood: '🍕 फ़ूड फ़िएस्टा',
    themeKitty: '💄 किटी पार्टी',
    themeCustom: '✨ नया बनाएं',
    skinRoyalGold: '👑 रॉयल गोल्ड',
    skinNeonParty: '⚡ नियॉन पार्टी',
    skinFreshMint: '🍃 फ्रेश मिंट',
    skinClassicRetro: '📜 क्लासिक रेट्रो',
    skinFloralQueen: '🌸 फ्लोरल क्वीन',
    skinFloralGarden: '🌸 फ्लोरल गार्डन',
    itemsStatus: (count, needed) => `${count} आइटम (${count >= needed ? 'वैध' : `आवश्यकता ${needed}`})`,
    importBtn: (count) => `${count} आइटम आयात करें`,
    bulkPlaceholder: 'अल्पविराम या नई लाइनों द्वारा अलग किए गए आइटम पेस्ट करें, जैसे:\nडोसा, जलेबी, समोसा, ढोकला',
    labelEmoji: 'इमोजी',
    labelNameEn: 'नाम (अंग्रेजी)',
    labelNameHi: 'हिंदी (वैकल्पिक)',
    labelNameGu: 'गुजराती (वैकल्पिक)',
    noItemsMatch: 'कोई आइटम खोज से मेल नहीं खाता।',
    addWarningSuffix: (needed, current) => ` और ${needed - current} जोड़ें!`,
    uploadTheme: '📂 अपलोड करें',
    uploadInvalid: 'अमान्य JSON प्रारूप। इसमें "name" ऑब्जेक्ट और "items" एरे होना चाहिए।',
    uploadDesign: '📂 अपलोड करें',
    uploadDesignInvalid: 'अमान्य फ़ाइल प्रारूप। कृपया एक वैध PNG, JPG, या JPEG इमेज अपलोड करें।'
  },
  gu: {
    configTitle: 'રૂપરેખાંકન',
    configSub: 'થીમ નિયમો, વસ્તુના નામ અને ટિકિટ લેઆઉટ સેટ કરો.',
    customTitleLabel: 'શીર્ષક',
    themeLabel: 'વસ્તુઓ',
    languageLabel: 'ભાષા',
    ticketStyleLabel: 'ટિકિટ ડિઝાઇન',
    ticketsCountLabel: 'ટિકિટ સંખ્યા',
    ticketsPerPageLabel: 'પૃષ્ઠ દીઠ',
    rowsCountLabel: 'પંક્તિઓ',
    columnsCountLabel: 'કૉલમ',
    itemsPerRowLabel: 'પંક્તિ દીઠ વસ્તુઓ',
    itemListHeader: 'વસ્તુ સૂચિ',
    addItemManual: '✍️ મેન્યુઅલી ઉમેરો',
    addItemBulk: '📋 બલ્ક આયાત',
    resetButton: 'રીસેટ',
    searchPlaceholder: '🔍 વસ્તુઓ શોધો...',
    generateButton: '✨ તંબોલા ટિકિટ બનાવો',
    needsItemsWarning: (count) => `ટિકિટ બનાવવા માટે તમારે સૂચિમાં ઓછામાં ઓછી ${count} વસ્તુઓની જરૂર છે.`,
    themeFood: '🍕 ફૂડ ફિએસ્ટા',
    themeKitty: '💄 કીટી પાર્ટી',
    themeCustom: '✨ કસ્ટમ બનાવો',
    skinRoyalGold: '👑 રોયલ ગોલ્ડ',
    skinNeonParty: '⚡ નિયોન પાર્ટી',
    skinFreshMint: '🍃 ફ્રેશ મિન્ટ',
    skinClassicRetro: '📜 ક્લાસિક રેટ્રો',
    skinFloralQueen: '🌸 ફ્લોરલ ક્વીન',
    skinFloralGarden: '🌸 ફ્લોરલ ગાર્ડન',
    itemsStatus: (count, needed) => `${count} વસ્તુઓ (${count >= needed ? 'માન્ય' : `જરૂર છે ${needed}`})`,
    importBtn: (count) => `${count} વસ્તુઓ આયાત કરો`,
    bulkPlaceholder: 'અલ્પવિરામ અથવા પંક્તિઓ દ્વારા અલગ કરેલી વસ્તુઓ પેસ્ટ કરો, જેમ કે:\nઢોસા, જલેબી, સમોસા, ઢોકળા',
    labelEmoji: 'ઇમોજી',
    labelNameEn: 'નામ (અંગ્રેજી)',
    labelNameHi: 'હિન્દી (વૈકલ્પિક)',
    labelNameGu: 'ગુજરાતી (વૈકલ્પિક)',
    noItemsMatch: 'કોઈ વસ્તુ શોધ સાથે મેળ ખાતી નથી.',
    addWarningSuffix: (needed, current) => ` વધુ ${needed - current} ઉમેરો!`,
    uploadTheme: '📂 અપલોડ કરો',
    uploadInvalid: 'અમાન્ય JSON ફોર્મેટ. તેમાં "name" ઓબ્જેક્ટ અને "items" એરે હોવું આવશ્યક છે.',
    uploadDesign: '📂 અપલોડ કરો',
    uploadDesignInvalid: 'અમાન્ય ફાઇલ ફોર્મેટ. કૃપા કરીને માન્ય PNG, JPG, અથવા JPEG ઇમેજ અપલોડ કરો.'
  }
};

export default function ControlPanel({
  language,
  setLanguage,
  ticketsPerPage,
  setTicketsPerPage,
  theme,
  setTheme,
  items,
  setItems,
  ticketsCount,
  setTicketsCount,
  ticketStyle,
  setTicketStyle,
  onGenerate,
  customTitle,
  setCustomTitle,
  customBgImage,
  setCustomBgImage,
  rows,
  setRows,
  columns,
  setColumns,
  itemsPerRow,
  setItemsPerRow
}) {
  const [newItemName, setNewItemName] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const neededItemsCount = rows * itemsPerRow;
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Handle theme JSON uploading
  const handleThemeUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.name || !data.items || !Array.isArray(data.items)) {
          alert(t.uploadInvalid);
          return;
        }

        // Map items with default translations if missing
        const parsedItems = data.items.map((item, index) => ({
          id: item.id || `uploaded-${index}-${Date.now()}`,
          name: {
            en: item.name?.en || item.name || '',
            hi: item.name?.hi || item.name?.en || item.name || '',
            gu: item.name?.gu || item.name?.en || item.name || ''
          }
        }));

        setTheme('custom');
        setItems(parsedItems);
        setCustomTitle({
          en: data.name.en || '',
          hi: data.name.hi || data.name.en || '',
          gu: data.name.gu || data.name.en || ''
        });
      } catch (err) {
        console.error(err);
        alert(language === 'hi' ? 'JSON फ़ाइल पार्स करने में विफल।' : language === 'gu' ? 'JSON ફાઇલ પાર્સ કરવામાં નિષ્ફળ.' : 'Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Handle custom background image uploading
  const handleDesignUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate that it's an image
    if (!file.type.startsWith('image/')) {
      alert(t.uploadDesignInvalid);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomBgImage(event.target.result); // Save base64 string
      setTicketStyle('custom-image-bg'); // Set skin style to image bg
    };
    reader.readAsDataURL(file);
  };

  // Handle bulk pasting of items with case-insensitive duplicate check
  const handleBulkImport = () => {
    if (!bulkInput.trim()) return;

    const lines = bulkInput.split(/[,\n]/);
    const newItemsList = [];
    const existingNames = new Set(items.map(item => item.name.en.trim().toLowerCase()));

    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      const nameStr = cleanLine.replace(/^[-\s]+|[-\s]+$/g, ''); // strip leading/trailing hyphens or space

      if (!nameStr) return;

      const lowerName = nameStr.toLowerCase();
      if (!existingNames.has(lowerName)) {
        existingNames.add(lowerName);
        newItemsList.push({
          id: `custom-bulk-${Date.now()}-${Math.random()}`,
          name: {
            en: nameStr,
            hi: nameStr,
            gu: nameStr
          }
        });
      }
    });

    if (newItemsList.length > 0) {
      setItems([...newItemsList, ...items]);
    }
    setBulkInput('');
  };

  // Handle adding a new item
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem = {
      id: `custom-${Date.now()}`,
      name: {
        en: newItemName.trim(),
        hi: newItemName.trim(),
        gu: newItemName.trim()
      }
    };

    setItems([newItem, ...items]);
    setNewItemName('');
  };

  // Reset theme items to original state
  const handleResetItems = () => {
    if (DEFAULT_THEMES[theme]) {
      setItems([...DEFAULT_THEMES[theme].items]);
    } else {
      setItems([]);
    }
  };

  // Remove an item
  const handleRemoveItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };



  return (
    <div className="glass-panel no-print" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
          {t.customTitleLabel}
        </label>
        <input
          type="text"
          value={customTitle[language] || ''}
          placeholder={language !== 'en' && customTitle.en ? customTitle.en : "e.g. rasoda"}
          onChange={(e) => {
            const val = e.target.value;
            setCustomTitle(prev => ({
              ...prev,
              [language]: val
            }));
          }}
          className="form-input"
        />
      </div>

      {/* Grid: Items + Language */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t.themeLabel}</label>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn btn-secondary"
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              cursor: 'pointer',
              height: '42px'
            }}
          >
            ✏️ {language === 'hi' ? 'सूची संपादित करें' : language === 'gu' ? 'સૂચિ સંપાદિત કરો' : 'Edit Items'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t.languageLabel}</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="form-input"
          >
            <option value="en">English</option>
            <option value="hi">Hindi (हिंदी)</option>
            <option value="gu">Gujarati (ગુજરાતી)</option>
          </select>
        </div>
      </div>

      {/* Grid Size Config: Rows + Columns + Items per Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t.rowsCountLabel}</label>
          <input
            type="number"
            min="1"
            max="6"
            value={rows}
            onChange={(e) => setRows(e.target.value === '' ? '' : parseInt(e.target.value))}
            onBlur={() => {
              let r = parseInt(rows);
              if (isNaN(r) || r < 1) r = 3;
              if (r > 6) r = 6;
              setRows(r);
              const minPer = Math.ceil((columns || 9) / r);
              if (itemsPerRow < minPer) setItemsPerRow(minPer);
            }}
            className="form-input"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t.columnsCountLabel}</label>
          <input
            type="number"
            min="1"
            max="9"
            value={columns}
            onChange={(e) => setColumns(e.target.value === '' ? '' : parseInt(e.target.value))}
            onBlur={() => {
              let c = parseInt(columns);
              if (isNaN(c) || c < 1) c = 9;
              if (c > 9) c = 9;
              setColumns(c);
              const minPer = Math.ceil(c / (rows || 3));
              const maxPer = c;
              if (itemsPerRow < minPer) setItemsPerRow(minPer);
              if (itemsPerRow > maxPer) setItemsPerRow(maxPer);
            }}
            className="form-input"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t.itemsPerRowLabel}</label>
          <input
            type="number"
            min={Math.ceil((columns || 9) / (rows || 3))}
            max={columns || 9}
            value={itemsPerRow}
            onChange={(e) => setItemsPerRow(e.target.value === '' ? '' : parseInt(e.target.value))}
            onBlur={() => {
              let ipr = parseInt(itemsPerRow);
              const minPer = Math.ceil((columns || 9) / (rows || 3));
              const maxPer = columns || 9;
              if (isNaN(ipr) || ipr < minPer) ipr = minPer;
              if (ipr > maxPer) ipr = maxPer;
              setItemsPerRow(ipr);
            }}
            className="form-input"
          />
        </div>
      </div>

      {/* Grid: Ticket Style + Count + Per Page */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t.ticketStyleLabel}</label>
            <label htmlFor="design-upload" style={{ fontSize: '11px', color: 'var(--accent-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
              {t.uploadDesign}
            </label>
            <input
              type="file"
              id="design-upload"
              accept=".png,.jpg,.jpeg,.webp"
              style={{ display: 'none' }}
              onChange={handleDesignUpload}
            />
          </div>
          <select
            value={ticketStyle}
            onChange={(e) => setTicketStyle(e.target.value)}
            className="form-input"
          >
            <option value="royal-gold">{t.skinRoyalGold}</option>
            <option value="neon-party">{t.skinNeonParty}</option>
            <option value="fresh-mint">{t.skinFreshMint}</option>
            <option value="classic-retro">{t.skinClassicRetro}</option>
            <option value="floral-queen">{t.skinFloralQueen}</option>
            <option value="floral-garden">{t.skinFloralGarden}</option>
            {customBgImage && (
              <option value="custom-image-bg">
                🖼️ {language === 'hi' ? 'कस्टम बैकग्राउंड' : language === 'gu' ? 'કસ્ટમ બેકગ્રાઉન્ડ' : 'Custom Background'}
              </option>
            )}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t.ticketsCountLabel}</label>
          <input
            type="number"
            min="1"
            max="120"
            value={ticketsCount}
            onChange={(e) => setTicketsCount(e.target.value === '' ? '' : parseInt(e.target.value))}
            onBlur={() => {
              let tc = parseInt(ticketsCount);
              if (isNaN(tc) || tc < 1) tc = 6;
              if (tc > 120) tc = 120;
              setTicketsCount(tc);
            }}
            className="form-input"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t.ticketsPerPageLabel}</label>
          <select
            value={ticketsPerPage}
            onChange={(e) => setTicketsPerPage(parseInt(e.target.value))}
            className="form-input"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
      </div>

      {/* Main Generate Button */}
      <button
        onClick={onGenerate}
        disabled={items.length < neededItemsCount}
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: '14px 20px',
          fontSize: '16px',
          fontWeight: '700',
          marginTop: '10px',
          opacity: items.length < neededItemsCount ? 0.5 : 1,
          cursor: items.length < neededItemsCount ? 'not-allowed' : 'pointer'
        }}
      >
        {t.generateButton}
      </button>

      {/* Item List Modal Popup */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                ⚙️ {t.itemListHeader}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
              <button
                onClick={handleResetItems}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'none', border: 'none', color: 'var(--accent-secondary)', cursor: 'pointer', alignSelf: 'flex-end' }}
                title="Clear items list"
              >
                <RotateCcw size={12} /> {language === 'hi' ? 'सूची साफ़ करें' : language === 'gu' ? 'સૂચિ સાફ કરો' : 'Clear List'}
              </button>


              <div className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={t.bulkPlaceholder}
                  className="form-input"
                  rows="3"
                  style={{ resize: 'vertical', fontSize: '13px', fontFamily: 'inherit' }}
                />
                <button
                  type="button"
                  onClick={handleBulkImport}
                  className="btn btn-primary"
                  style={{ padding: '8px 12px', fontSize: '13px', width: '100%' }}
                  disabled={!bulkInput.trim()}
                >
                  {t.importBtn(bulkInput.split(/[,\n]/).filter(item => item.trim()).length || '')}
                </button>
              </div>

              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '6px',
                paddingRight: '4px',
                marginTop: '12px'
              }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>{item.name.en}</span>
                        {(item.name.hi !== item.name.en || item.name.gu !== item.name.en) && (
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            {item.name.hi} / {item.name.gu}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                    {language === 'hi' ? 'कोई आइटम नहीं' : language === 'gu' ? 'કોઈ વસ્તુ નથી' : 'No items in list'}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '8px 24px', fontSize: '13px' }}
              >
                {language === 'hi' ? 'हो गया' : language === 'gu' ? 'થઈ ગયું' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
