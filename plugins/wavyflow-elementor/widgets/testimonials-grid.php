<?php
namespace WavyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Repeater;

if (!defined('ABSPATH')) exit;

class Testimonials_Grid extends Widget_Base {
    public function get_name() { return 'wf-testimonials-grid'; }
    public function get_title() { return 'WavyFlow Testimonials Grid'; }
    public function get_icon() { return 'eicon-testimonial'; }
    public function get_categories() { return ['wavyflow']; }

    protected function register_controls() {
        $this->start_controls_section('header_section', ['label' => 'Cabecalho']);
        $this->add_control('number', ['label' => 'Numero', 'type' => Controls_Manager::TEXT, 'default' => '03']);
        $this->add_control('label', ['label' => 'Label', 'type' => Controls_Manager::TEXT, 'default' => 'Depoimentos']);
        $this->add_control('heading', ['label' => 'Titulo', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Resultados de quem ja aplica o metodo']);
        $this->add_control('subtitle', ['label' => 'Subtitulo', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Pessoas comuns que transformaram leitura em renda real.']);
        $this->add_control('dark_mode', ['label' => 'Modo escuro', 'type' => Controls_Manager::SWITCHER, 'default' => 'yes']);
        $this->end_controls_section();

        $this->start_controls_section('images_section', ['label' => 'Imagens']);
        $repeater = new Repeater();
        $repeater->add_control('image', ['label' => 'Imagem', 'type' => Controls_Manager::MEDIA]);
        $repeater->add_control('is_hero', ['label' => 'Imagem principal (grande)', 'type' => Controls_Manager::SWITCHER, 'default' => '']);
        $this->add_control('testimonials', [
            'label' => 'Depoimentos',
            'type' => Controls_Manager::REPEATER,
            'fields' => $repeater->get_controls(),
            'default' => [
                ['is_hero' => 'yes'],
                ['is_hero' => ''],
                ['is_hero' => ''],
                ['is_hero' => ''],
                ['is_hero' => ''],
            ],
        ]);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $dark = ($s['dark_mode'] ?? '') === 'yes';
        ?>
        <div class="wf-block<?php echo $dark ? ' wf-block--dark' : ''; ?>">
            <div class="wf-content">
                <div class="wf-wrap">
                    <div class="wf-shead wf-rv">
                        <div class="wf-label"><span class="wf-num"><?php echo esc_html($s['number']); ?></span> <?php echo esc_html($s['label']); ?></div>
                        <h2 class="wf-h2"><?php echo esc_html($s['heading']); ?></h2>
                        <p class="wf-body"><?php echo esc_html($s['subtitle']); ?></p>
                    </div>
                    <div class="wf-tst-grid wf-rv">
                        <?php foreach ($s['testimonials'] as $i => $tst):
                            $hero = $tst['is_hero'] === 'yes';
                            $hasImg = !empty($tst['image']['url']);
                        ?>
                        <div class="wf-tst-img<?php echo $hero ? ' wf-tst-img--hero' : ''; ?>">
                            <?php if ($hasImg): ?>
                                <img src="<?php echo esc_url($tst['image']['url']); ?>" alt="Depoimento">
                            <?php else: ?>
                                <div class="wf-ph"><span class="wf-ph-label"><?php echo sprintf('%02d', $i + 1); ?> · Depoimento</span></div>
                            <?php endif; ?>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}
