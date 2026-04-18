<?php
namespace WavyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Group_Control_Typography;
use Elementor\Group_Control_Background;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Box_Shadow;

if (!defined('ABSPATH')) exit;

class WavyFlow_Section extends Widget_Base {
    public function get_name() { return 'wf-section'; }
    public function get_title() { return 'WavyFlow Section'; }
    public function get_icon() { return 'eicon-code'; }
    public function get_categories() { return ['wavyflow']; }
    public function get_keywords() { return ['wavyflow', 'section', 'html', 'template']; }

    protected function register_controls() {
        // ─── HTML Original (hidden in normal use, stores the source) ───
        $this->start_controls_section('source_section', [
            'label' => 'Codigo Fonte',
            'tab' => Controls_Manager::TAB_CONTENT,
        ]);
        $this->add_control('original_html', [
            'label' => 'HTML Original',
            'type' => Controls_Manager::TEXTAREA,
            'default' => '',
            'description' => 'Codigo HTML original da secao. Gerado automaticamente pelo WavyFlow.',
            'rows' => 6,
        ]);
        $this->add_control('section_label', [
            'label' => 'Nome da secao',
            'type' => Controls_Manager::TEXT,
            'default' => 'Secao WavyFlow',
        ]);
        $this->end_controls_section();

        // ─── Editable Fields (auto-extracted) ───
        $this->start_controls_section('text_section', [
            'label' => 'Textos',
            'tab' => Controls_Manager::TAB_CONTENT,
        ]);
        $this->add_control('edit_headline', [
            'label' => 'Headline',
            'type' => Controls_Manager::TEXTAREA,
            'default' => '',
            'description' => 'Titulo principal (h1 ou h2). Deixe vazio para manter o original.',
            'rows' => 3,
        ]);
        $this->add_control('edit_subtitle', [
            'label' => 'Subtitulo',
            'type' => Controls_Manager::TEXTAREA,
            'default' => '',
            'description' => 'Paragrafo principal. Deixe vazio para manter o original.',
            'rows' => 3,
        ]);
        $this->add_control('edit_paragraph_2', [
            'label' => 'Paragrafo 2',
            'type' => Controls_Manager::TEXTAREA,
            'default' => '',
            'description' => 'Segundo paragrafo (se existir). Deixe vazio para manter o original.',
            'rows' => 3,
        ]);
        $this->end_controls_section();

        // ─── CTA ───
        $this->start_controls_section('cta_section', [
            'label' => 'Botao CTA',
            'tab' => Controls_Manager::TAB_CONTENT,
        ]);
        $this->add_control('edit_cta_text', [
            'label' => 'Texto do botao',
            'type' => Controls_Manager::TEXT,
            'default' => '',
            'description' => 'Deixe vazio para manter o original.',
        ]);
        $this->add_control('edit_cta_url', [
            'label' => 'Link do botao',
            'type' => Controls_Manager::URL,
            'default' => ['url' => ''],
            'description' => 'Deixe vazio para manter o original.',
        ]);
        $this->end_controls_section();

        // ─── Image ───
        $this->start_controls_section('image_section', [
            'label' => 'Imagem',
            'tab' => Controls_Manager::TAB_CONTENT,
        ]);
        $this->add_control('edit_image', [
            'label' => 'Imagem principal',
            'type' => Controls_Manager::MEDIA,
            'description' => 'Substitui o placeholder ou imagem existente na secao.',
        ]);
        $this->end_controls_section();

        // ─── Videos (YouTube / VTurb) ───
        $this->start_controls_section('videos_section', [
            'label' => 'Videos',
            'tab' => Controls_Manager::TAB_CONTENT,
        ]);
        for ($i = 1; $i <= 3; $i++) {
            $this->add_control("edit_video_{$i}_id", [
                'label' => "Video {$i} - ID / Codigo",
                'type' => Controls_Manager::TEXT,
                'default' => '',
                'description' => "Cole o ID do YouTube (ex: dQw4w9WgXcQ) ou do player VTurb. Deixe vazio para manter o original.",
            ]);
            $this->add_control("edit_video_{$i}_type", [
                'label' => "Video {$i} - Tipo",
                'type' => Controls_Manager::SELECT,
                'default' => '',
                'options' => [
                    '' => 'Manter original',
                    'youtube' => 'YouTube',
                    'vturb' => 'VTurb',
                ],
            ]);
        }
        $this->end_controls_section();

        // ─── Original Values (auto-populated, hidden) ───
        $this->start_controls_section('originals_section', [
            'label' => 'Valores Originais (auto)',
            'tab' => Controls_Manager::TAB_CONTENT,
        ]);
        $this->add_control('orig_headline', [
            'label' => 'Headline original',
            'type' => Controls_Manager::HIDDEN,
            'default' => '',
        ]);
        $this->add_control('orig_subtitle', [
            'label' => 'Subtitulo original',
            'type' => Controls_Manager::HIDDEN,
            'default' => '',
        ]);
        $this->add_control('orig_paragraph_2', [
            'label' => 'Paragrafo 2 original',
            'type' => Controls_Manager::HIDDEN,
            'default' => '',
        ]);
        $this->add_control('orig_cta_text', [
            'label' => 'CTA original',
            'type' => Controls_Manager::HIDDEN,
            'default' => '',
        ]);
        $this->add_control('orig_cta_url', [
            'label' => 'CTA URL original',
            'type' => Controls_Manager::HIDDEN,
            'default' => '',
        ]);
        for ($i = 1; $i <= 3; $i++) {
            $this->add_control("orig_video_{$i}_id", [
                'label' => "Video {$i} ID original",
                'type' => Controls_Manager::HIDDEN,
                'default' => '',
            ]);
            $this->add_control("orig_video_{$i}_type", [
                'label' => "Video {$i} tipo original",
                'type' => Controls_Manager::HIDDEN,
                'default' => '',
            ]);
        }
        // Shared CSS / JS — injected by the export only into the first/last widget of the page.
        // Rendered inline once so the whole page shares the same stylesheet/scripts.
        $this->add_control('shared_css', [
            'label' => 'CSS compartilhado',
            'type' => Controls_Manager::HIDDEN,
            'default' => '',
        ]);
        $this->add_control('shared_js', [
            'label' => 'JS compartilhado',
            'type' => Controls_Manager::HIDDEN,
            'default' => '',
        ]);
        $this->end_controls_section();

        /* ============================================================
         *  STYLE TAB — cores, tipografia, spacing, botões
         * ============================================================ */

        // ─── Cores gerais ───
        $this->start_controls_section('style_colors', [
            'label' => 'Cores',
            'tab' => Controls_Manager::TAB_STYLE,
        ]);
        $this->add_control('style_bg_color', [
            'label' => 'Cor de fundo da secao',
            'type' => Controls_Manager::COLOR,
            'selectors' => [
                '{{WRAPPER}} .wfr' => 'background-color: {{VALUE}};',
            ],
        ]);
        $this->add_control('style_text_color', [
            'label' => 'Cor do texto',
            'type' => Controls_Manager::COLOR,
            'selectors' => [
                '{{WRAPPER}} .wfr, {{WRAPPER}} .wfr p, {{WRAPPER}} .wfr li, {{WRAPPER}} .wfr span:not([class*="badge"]):not([class*="tag"])' => 'color: {{VALUE}};',
            ],
        ]);
        $this->add_control('style_heading_color', [
            'label' => 'Cor dos titulos',
            'type' => Controls_Manager::COLOR,
            'selectors' => [
                '{{WRAPPER}} .wfr h1, {{WRAPPER}} .wfr h2, {{WRAPPER}} .wfr h3, {{WRAPPER}} .wfr h4' => 'color: {{VALUE}};',
            ],
        ]);
        $this->add_control('style_highlight_color', [
            'label' => 'Cor de destaque (em / strong)',
            'type' => Controls_Manager::COLOR,
            'selectors' => [
                '{{WRAPPER}} .wfr em, {{WRAPPER}} .wfr strong, {{WRAPPER}} .wfr .pix-word' => 'color: {{VALUE}};',
            ],
        ]);
        $this->end_controls_section();

        // ─── Tipografia ───
        $this->start_controls_section('style_typography', [
            'label' => 'Tipografia',
            'tab' => Controls_Manager::TAB_STYLE,
        ]);
        $this->add_group_control(Group_Control_Typography::get_type(), [
            'name' => 'style_body_typography',
            'label' => 'Texto do corpo',
            'selector' => '{{WRAPPER}} .wfr, {{WRAPPER}} .wfr p, {{WRAPPER}} .wfr li',
        ]);
        $this->add_group_control(Group_Control_Typography::get_type(), [
            'name' => 'style_h1_typography',
            'label' => 'Titulo H1',
            'selector' => '{{WRAPPER}} .wfr h1',
        ]);
        $this->add_group_control(Group_Control_Typography::get_type(), [
            'name' => 'style_h2_typography',
            'label' => 'Titulo H2',
            'selector' => '{{WRAPPER}} .wfr h2',
        ]);
        $this->add_group_control(Group_Control_Typography::get_type(), [
            'name' => 'style_h3_typography',
            'label' => 'Titulo H3',
            'selector' => '{{WRAPPER}} .wfr h3',
        ]);
        $this->end_controls_section();

        // ─── Botao CTA ───
        $this->start_controls_section('style_cta', [
            'label' => 'Botao CTA',
            'tab' => Controls_Manager::TAB_STYLE,
        ]);
        $this->add_control('style_cta_bg', [
            'label' => 'Cor de fundo',
            'type' => Controls_Manager::COLOR,
            'selectors' => [
                '{{WRAPPER}} .wfr .btn, {{WRAPPER}} .wfr .btn-cta, {{WRAPPER}} .wfr .btn-solid, {{WRAPPER}} .wfr .price-cta' => 'background-color: {{VALUE}}; background-image: none;',
            ],
        ]);
        $this->add_control('style_cta_hover_bg', [
            'label' => 'Cor de fundo (hover)',
            'type' => Controls_Manager::COLOR,
            'selectors' => [
                '{{WRAPPER}} .wfr .btn:hover, {{WRAPPER}} .wfr .btn-cta:hover, {{WRAPPER}} .wfr .btn-solid:hover, {{WRAPPER}} .wfr .price-cta:hover' => 'background-color: {{VALUE}}; background-image: none;',
            ],
        ]);
        $this->add_control('style_cta_color', [
            'label' => 'Cor do texto',
            'type' => Controls_Manager::COLOR,
            'selectors' => [
                '{{WRAPPER}} .wfr .btn, {{WRAPPER}} .wfr .btn-cta, {{WRAPPER}} .wfr .btn-solid, {{WRAPPER}} .wfr .price-cta' => 'color: {{VALUE}};',
            ],
        ]);
        $this->add_group_control(Group_Control_Typography::get_type(), [
            'name' => 'style_cta_typography',
            'label' => 'Tipografia do botao',
            'selector' => '{{WRAPPER}} .wfr .btn, {{WRAPPER}} .wfr .btn-cta, {{WRAPPER}} .wfr .btn-solid, {{WRAPPER}} .wfr .price-cta',
        ]);
        $this->add_control('style_cta_radius', [
            'label' => 'Border radius',
            'type' => Controls_Manager::SLIDER,
            'size_units' => ['px', '%'],
            'range' => ['px' => ['min' => 0, 'max' => 60]],
            'selectors' => [
                '{{WRAPPER}} .wfr .btn, {{WRAPPER}} .wfr .btn-cta, {{WRAPPER}} .wfr .btn-solid, {{WRAPPER}} .wfr .price-cta' => 'border-radius: {{SIZE}}{{UNIT}};',
            ],
        ]);
        $this->end_controls_section();

        // ─── Cards (pricing, bonus, testimonial) ───
        $this->start_controls_section('style_cards', [
            'label' => 'Cards',
            'tab' => Controls_Manager::TAB_STYLE,
        ]);
        $this->add_control('style_card_bg', [
            'label' => 'Cor de fundo',
            'type' => Controls_Manager::COLOR,
            'selectors' => [
                '{{WRAPPER}} .wfr .card, {{WRAPPER}} .wfr .price-card, {{WRAPPER}} .wfr .bonus-card' => 'background-color: {{VALUE}};',
            ],
        ]);
        $this->add_control('style_card_border_color', [
            'label' => 'Cor da borda',
            'type' => Controls_Manager::COLOR,
            'selectors' => [
                '{{WRAPPER}} .wfr .card, {{WRAPPER}} .wfr .price-card, {{WRAPPER}} .wfr .bonus-card' => 'border-color: {{VALUE}};',
            ],
        ]);
        $this->add_control('style_card_radius', [
            'label' => 'Border radius',
            'type' => Controls_Manager::SLIDER,
            'size_units' => ['px'],
            'range' => ['px' => ['min' => 0, 'max' => 48]],
            'selectors' => [
                '{{WRAPPER}} .wfr .card, {{WRAPPER}} .wfr .price-card, {{WRAPPER}} .wfr .bonus-card' => 'border-radius: {{SIZE}}{{UNIT}};',
            ],
        ]);
        $this->end_controls_section();

        // ─── Spacing ───
        $this->start_controls_section('style_spacing', [
            'label' => 'Espacamento',
            'tab' => Controls_Manager::TAB_STYLE,
        ]);
        $this->add_control('style_padding', [
            'label' => 'Padding interno',
            'type' => Controls_Manager::DIMENSIONS,
            'size_units' => ['px', '%'],
            'selectors' => [
                '{{WRAPPER}} .wfr' => 'padding-top: {{TOP}}{{UNIT}}; padding-right: {{RIGHT}}{{UNIT}}; padding-bottom: {{BOTTOM}}{{UNIT}}; padding-left: {{LEFT}}{{UNIT}};',
            ],
        ]);
        $this->add_responsive_control('style_section_max_width', [
            'label' => 'Largura maxima do conteudo',
            'type' => Controls_Manager::SLIDER,
            'size_units' => ['px', '%'],
            'range' => ['px' => ['min' => 600, 'max' => 2400], '%' => ['min' => 40, 'max' => 100]],
            'selectors' => [
                '{{WRAPPER}} .wfr .content, {{WRAPPER}} .wfr .wrap' => 'max-width: {{SIZE}}{{UNIT}};',
            ],
        ]);
        $this->end_controls_section();

        // ─── Avancado (CSS custom) ───
        $this->start_controls_section('style_advanced', [
            'label' => 'CSS personalizado',
            'tab' => Controls_Manager::TAB_STYLE,
        ]);
        $this->add_control('custom_css', [
            'label' => 'CSS extra (aplicado dentro da secao)',
            'type' => Controls_Manager::CODE,
            'language' => 'css',
            'rows' => 10,
            'description' => 'Use .wfr como seletor raiz. Ex: <code>.wfr h1 { letter-spacing: -2px; }</code>',
        ]);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $html = $s['original_html'] ?? '';

        if (empty($html)) {
            if (\Elementor\Plugin::$instance->editor->is_edit_mode()) {
                echo '<div style="padding:40px;text-align:center;background:#1e1e1e;border-radius:12px;color:#888;font-family:sans-serif;">';
                echo '<p style="font-size:14px;margin-bottom:8px;">WavyFlow Section</p>';
                echo '<p style="font-size:11px;color:#555;">Cole o HTML da secao no campo "Codigo Fonte"</p>';
                echo '</div>';
            }
            return;
        }

        // Apply text replacements
        $output = $html;

        // Headline replacement
        $new_headline = trim($s['edit_headline'] ?? '');
        $orig_headline = trim($s['orig_headline'] ?? '');
        if ($new_headline !== '' && $orig_headline !== '' && $new_headline !== $orig_headline) {
            $output = str_replace($orig_headline, $new_headline, $output);
        }

        // Subtitle replacement
        $new_subtitle = trim($s['edit_subtitle'] ?? '');
        $orig_subtitle = trim($s['orig_subtitle'] ?? '');
        if ($new_subtitle !== '' && $orig_subtitle !== '' && $new_subtitle !== $orig_subtitle) {
            $output = str_replace($orig_subtitle, $new_subtitle, $output);
        }

        // Paragraph 2 replacement
        $new_p2 = trim($s['edit_paragraph_2'] ?? '');
        $orig_p2 = trim($s['orig_paragraph_2'] ?? '');
        if ($new_p2 !== '' && $orig_p2 !== '' && $new_p2 !== $orig_p2) {
            $output = str_replace($orig_p2, $new_p2, $output);
        }

        // CTA text replacement
        $new_cta = trim($s['edit_cta_text'] ?? '');
        $orig_cta = trim($s['orig_cta_text'] ?? '');
        if ($new_cta !== '' && $orig_cta !== '' && $new_cta !== $orig_cta) {
            $output = str_replace($orig_cta, $new_cta, $output);
        }

        // CTA URL replacement
        $cta_url = $s['edit_cta_url'] ?? [];
        $new_url = is_array($cta_url) ? trim($cta_url['url'] ?? '') : '';
        $orig_url = trim($s['orig_cta_url'] ?? '');
        if ($new_url !== '' && $orig_url !== '' && $new_url !== $orig_url) {
            $output = str_replace('href="' . $orig_url . '"', 'href="' . esc_url($new_url) . '"', $output);
        }

        // Video replacement (YouTube / VTurb) — swaps the ID (and type if it changed)
        // The ID appears in multiple places (data-wf-video, iframe src, id="vid_XYZ",
        // thumbnail URL, player script URL), so a single str_replace propagates everywhere.
        for ($i = 1; $i <= 3; $i++) {
            $orig_id   = trim($s["orig_video_{$i}_id"] ?? '');
            $orig_type = trim($s["orig_video_{$i}_type"] ?? '');
            $new_id    = trim($s["edit_video_{$i}_id"] ?? '');
            $new_type  = trim($s["edit_video_{$i}_type"] ?? '');
            if ($orig_id === '') continue;

            // If user only changed the type (kept same slot), use the original ID
            $target_id = $new_id !== '' ? $new_id : $orig_id;
            $target_type = $new_type !== '' ? $new_type : $orig_type;

            // Same type → simple ID swap across the whole markup
            if ($target_type === $orig_type) {
                if ($target_id !== $orig_id) {
                    $output = str_replace($orig_id, $target_id, $output);
                }
                continue;
            }

            // Type changed → rebuild the entire video block
            $pattern = '/<div[^>]*data-wf-video="' . preg_quote($orig_type, '/') . ':' . preg_quote($orig_id, '/') . '"[^>]*>[\s\S]*?<\/div>(?:\s*<script[^>]*>[\s\S]*?<\/script>)?/i';

            if ($target_type === 'youtube') {
                $replacement = '<div class="reveal" data-wf-video="youtube:' . esc_attr($target_id) . '" style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden">'
                    . '<iframe src="https://www.youtube.com/embed/' . esc_attr($target_id) . '" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>'
                    . '</div>';
            } elseif ($target_type === 'vturb') {
                $replacement = '<div class="reveal" data-wf-video="vturb:' . esc_attr($target_id) . '" id="vid_' . esc_attr($target_id) . '" style="position:relative;width:100%;padding-top:56.25%">'
                    . '<img id="thumb_' . esc_attr($target_id) . '" src="https://images.converteai.net/' . esc_attr($target_id) . '/players/' . esc_attr($target_id) . '/thumbnail.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block" alt="thumbnail">'
                    . '</div>'
                    . '<script type="text/javascript">var s=document.createElement("script");s.src="https://scripts.converteai.net/' . esc_attr($target_id) . '/players/' . esc_attr($target_id) . '/player.js";s.async=true;document.head.appendChild(s);</script>';
            } else {
                continue;
            }

            $output = preg_replace($pattern, $replacement, $output, 1);
        }

        // Image replacement — replace placeholder div with actual image
        $img = $s['edit_image'] ?? [];
        $img_url = is_array($img) ? ($img['url'] ?? '') : '';
        if ($img_url !== '') {
            $img_tag = '<img src="' . esc_url($img_url) . '" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center 20%;border-radius:inherit;">';
            // Replace ph (placeholder) — uses (?s) flag for dot-matches-newline
            $output = preg_replace(
                '/(?s)<div class="ph">.*?<\/div>\s*<\/div>\s*<\/div>/',
                $img_tag,
                $output,
                1
            );
            // Replace hero-video placeholder
            $output = preg_replace(
                '/(?s)<div class="hero-video-placeholder">.*?<\/div>\s*<\/div>/',
                $img_tag,
                $output,
                1
            );
            // Replace hero-video container itself
            $output = preg_replace(
                '/(?s)<div class="hero-video">.*?<\/div>\s*<\/div>\s*<\/div>/',
                '<div class="hero-video" style="display:flex;align-items:center;justify-content:center;overflow:hidden;">' . $img_tag . '</div>',
                $output,
                1
            );
        }

        // Shared CSS — present only on the first widget of the exported page.
        // Printed once as a raw <style> block so every following widget uses the same stylesheet.
        $shared_css = $s['shared_css'] ?? '';
        if (!empty($shared_css)) {
            echo $shared_css;
        }

        // Custom CSS per-widget (scoped via attribute selector on the unique widget id)
        $custom_css = trim($s['custom_css'] ?? '');
        $widget_id  = '';
        if ($custom_css !== '') {
            $widget_id = 'wfr-' . substr(md5($this->get_id()), 0, 8);
            $scoped = preg_replace('/(^|\})\s*\.wfr\b/', '$1 [data-wfr-id="' . $widget_id . '"].wfr', $custom_css);
            echo '<style>' . $scoped . '</style>';
        }

        if ($widget_id !== '') {
            echo '<div class="wfr" data-wfr-id="' . esc_attr($widget_id) . '">' . $output . '</div>';
        } else {
            echo '<div class="wfr">' . $output . '</div>';
        }

        // Shared JS — present only on the last widget of the exported page.
        // Printed after all markup so scripts (reveal observers, accordion, etc.) run once.
        $shared_js = $s['shared_js'] ?? '';
        if (!empty($shared_js)) {
            echo $shared_js;
        }
    }
}
