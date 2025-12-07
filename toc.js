// Cấu trúc mục lục 3 cấp: Nikāya -> (nhóm) -> bài
// Bạn có thể dùng chung cho menu, accordion, search.

window.SUTRA_INDEX = [
  /* ====================== DĪGHA NIKĀYA (DN) ====================== */
  {
    type: "nikaya",
    key: "DN",
    labelVi: "Trường Bộ Kinh (Dīgha)",
    labelEn: "Dīgha Nikāya (Long Discourses)",
    children: [
      {
        type: "sutta",
        id: "dn01",
        code: "DN 1",
        href: "dn01.html",
        titlePali: "DN 1 – Brahmajāla Sutta (The Supreme Net)",
        titleVi: "DN 1 – Brahmajāla Sutta — Kinh Phạm Võng"
      },
      {
        type: "sutta",
        id: "dn02",
        code: "DN 2",
        href: "dn02.html",
        titlePali:
          "DN 2 – Sāmaññaphala Sutta (The Fruits of the Contemplative Life)",
        titleVi: "DN 2 – Sāmaññaphala Sutta — Kinh Sa-môn Quả"
      }
      // ... DN 3–34 bạn thêm tiếp ở đây ...
    ]
  },

  /* ====================== MAJJHIMA NIKĀYA (MN) ====================== */
  {
    type: "nikaya",
    key: "MN",
    labelVi: "Trung Bộ Kinh (Majjhima)",
    labelEn: "Majjhima Nikāya (Middle-Length)",
    children: [
      {
        type: "sutta",
        id: "mn001",
        code: "MN 1",
        href: "mn001.html",
        titlePali: "MN 1 – Mūlapariyāya Sutta (The Root of All Things)",
        titleVi: "MN 1 – Mūlapariyāya Sutta — Kinh Căn Bản Pháp Môn"
      },
      {
        type: "sutta",
        id: "mn131",
        code: "MN 131",
        href: "mn131-bhaddekaratta.html",
        titlePali: "MN 131 – Bhaddekaratta Sutta (A Single Excellent Night)",
        titleVi: "MN 131 – Bhaddekaratta Sutta — Kinh Nhất Dạ Hiền Giả"
      },
      {
        type: "sutta",
        id: "mn132",
        code: "MN 132",
        href: "mn132.html",
        titlePali:
          "MN 132 – Ānandabhaddekaratta Sutta (Ānanda & the Single Excellent Night)",
        titleVi:
          "MN 132 – Ānandabhaddekaratta Sutta — Kinh Nhất Dạ Hiền Giả do Tôn giả A Nan Thuyết"
      }
      // ... thêm các MN khác sau này ...
    ]
  },

  /* ====================== SAṂYUTTA NIKĀYA (SN) ====================== */
  {
    type: "nikaya",
    key: "SN",
    labelVi: "Tương Ưng Bộ Kinh (Saṃyutta)",
    labelEn: "Saṃyutta Nikāya (Connected Discourses)",
    children: [
      {
        /* Tập I – SN 1–11: level thứ 2 */
        type: "group",
        key: "SN1-11",
        labelVi: "SN 1–11 – Tập I: Thiên Có Kệ",
        labelEn: "SN 1–11 – Sagāthāvagga (Verses)",
        children: [
          {
            type: "sutta",
            id: "sn01",
            code: "SN 1",
            href: "sn01-devata-samyutta.html",
            titlePali: "SN 1 – Devatā Saṃyutta",
            titleVi:
              "SN 1 – Devatā Saṃyutta — [01] Chương Một: Tương Ưng Chư Thiên"
          }
       
        ]
      },
      {
         type: "group",
        key: "SN2-11",
        labelVi: "SN 1–11 – Tập 2: Ttest",
        labelEn: "SN 1–11 – Sagāthāvagga (Verses)",
        children: [
          {
            type: "sutta",
            id: "sn01",
            code: "SN 1",
            href: "sn01-devata-samyutta.html",
            titlePali: "SN 1 – Devatā Saṃyutta",
            titleVi:
              "SN 1 – Devatā Saṃyutta — [01] Chương Một: Tương Ưng Chư Thiên"
          }
       
        ]
      }

      // sau này bạn có thể thêm các tập SN 12–... tương tự
      
    ]
  },

  /* ====================== AṄGUTTARA NIKĀYA (AN) ====================== */
  {
    type: "nikaya",
    key: "AN",
    labelVi: "Tăng Chi Bộ Kinh (Aṅguttara)",
    labelEn: "Aṅguttara Nikāya (Numerical Discourses)",
    children: [
      {
        type: "sutta",
        id: "an01",
        code: "AN 1",
        href: "an-1-ekakanipata.html",
        titlePali: "AN 1 – Ekakanipāta (Book of the Ones)",
        titleVi: "AN 1 – Ekakanipāta — Chương Một Pháp"
      },
      {
        type: "sutta",
        id: "an02",
        code: "AN 2",
        href: "an-2-dukanipata.html",
        titlePali: "AN 2 – Dukanipāta (Book of the Twos)",
        titleVi: "AN 2 – Dukanipāta — Chương Hai Pháp"
      }
      // ... các AN 3–11 bạn thêm tiếp ...
    ]
  },

  /* ====================== KHUDDAKA NIKĀYA (KN) ====================== */
  {
    type: "nikaya",
    key: "KN",
    labelVi: "Tiểu Bộ Kinh (Khuddaka)",
    labelEn: "Khuddaka Nikāya (Minor Collection)",
    children: [
      {
        type: "sutta",
        id: "kn-khp",
        code: "Khp",
        href: "kn-khuddakapatha.html",
        titlePali: "Khp – Khuddakapāṭha (Short Passages)",
        titleVi: "Khp – Khuddakapāṭha — Kinh Tiểu Tụng"
      },
      {
        type: "sutta",
        id: "kn-dhp",
        code: "Dhp",
        href: "kn-dhammapada.html",
        titlePali: "Dhp – Dhammapada (The Dhamma Verses)",
        titleVi: "Dhp – Dhammapada — Kinh Pháp Cú"
      },
      {
        type: "sutta",
        id: "kn-ud",
        code: "Ud",
        href: "kn-udana.html",
        titlePali: "Ud – Udāna (Inspired Utterances)",
        titleVi: "Ud – Udāna — Kinh Cảm Hứng Ngữ"
      },
      {
        type: "sutta",
        id: "kn-it",
        code: "It",
        href: "kn-itivuttaka.html",
        titlePali: "It – Itivuttaka (This Was Said)",
        titleVi: "It – Itivuttaka — Kinh Như Thị Ngữ"
      },
      {
        type: "sutta",
        id: "kn-sn",
        code: "Sn",
        href: "kn-suttanipata.html",
        titlePali: "Sn – Sutta Nipāta (Collection of Discourses)",
        titleVi: "Sn – Sutta Nipāta — Kinh Tập"
      },
      {
        type: "sutta",
        id: "kn-vv",
        code: "Vv",
        href: "kn-vimanavatthu.html",
        titlePali: "Vv – Vimānavatthu (Stories of Heavenly Mansions)",
        titleVi: "Vv – Vimānavatthu — Kinh Thiên Cung Sự"
      },
      {
        type: "sutta",
        id: "kn-pv",
        code: "Pv",
        href: "kn-petavatthu.html",
        titlePali: "Pv – Petavatthu (Stories of Hungry Ghosts)",
        titleVi: "Pv – Petavatthu — Kinh Ngạ Quỷ Sự"
      },
      {
        type: "sutta",
        id: "kn-thag",
        code: "Thag",
        href: "kn-theragatha.html",
        titlePali: "Thag – Theragāthā (Verses of the Elder Monks)",
        titleVi: "Thag – Theragāthā — Kinh Trưởng Lão Tăng Kệ"
      },
      {
        type: "sutta",
        id: "kn-thig",
        code: "Thig",
        href: "kn-therigatha.html",
        titlePali: "Thig – Therīgāthā (Verses of the Elder Nuns)",
        titleVi: "Thig – Therīgāthā — Kinh Trưởng Lão Ni Kệ"
      },
      {
        type: "sutta",
        id: "kn-j",
        code: "J",
        href: "kn-jataka.html",
        titlePali: "J – Jātaka (Birth Stories)",
        titleVi: "J – Jātaka — Chuyện Tiền Thân Đức Phật"
      },
      {
        type: "sutta",
        id: "kn-bv",
        code: "Bv",
        href: "kn-buddhavamsa.html",
        titlePali: "Bv – Buddhavaṃsa (Chronicle of the Buddhas)",
        titleVi: "Bv – Buddhavaṃsa — Phật Sử"
      },
      {
        type: "sutta",
        id: "kn-cp",
        code: "Cp",
        href: "kn-cariyapitaka.html",
        titlePali: "Cp – Cariyāpiṭaka (Basket of Conduct)",
        titleVi: "Cp – Cariyāpiṭaka — Hạnh Tạng"
      }
    ]
  },

  /* ====================== TRANG KINH MẪU ====================== */
  {
    type: "nikaya",
    key: "SAMPLE",
    labelVi: "Trang kinh mẫu",
    labelEn: "Sample Sutta Page",
    children: [
      {
        type: "sutta",
        id: "sample-sutta",
        code: "Sample",
        href: "sample-sutta.html",
        titlePali: "Sample Sutta (Demo Layout)",
        titleVi: "Sample Sutta — Trang kinh mẫu để thử giao diện"
      }
    ]
  }
];
