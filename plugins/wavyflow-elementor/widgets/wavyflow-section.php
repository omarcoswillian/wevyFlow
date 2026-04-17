<?php
namespace WavyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;

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

        // Wrap in .wfr scope to increase CSS specificity over Elementor theme
        echo '<div class="wfr">' . $output . '</div>';
    }
}
